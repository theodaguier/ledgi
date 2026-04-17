import Papa from "papaparse";

const GC_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1EZ5n7QDGaRIot5M86dwqd5UFSGEDTeTRzEq3D9uEDkM/export?format=csv";

const EEE_UK = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI",
  "FR", "DE", "GR", "HU", "IS", "IE", "IT", "LV",
  "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT",
  "RO", "SK", "SI", "ES", "SE", "GB",
]);

interface ParsedRow {
  Name?: string;
  SWIFT?: string;
  Countries?: string;
  Institution_id?: string;
}

interface BankRecord {
  id: string;
  name: string;
  bic: string;
  countries: string[];
}

let cachedBanks: { data: BankRecord[]; expiresAt: number } | null = null;

export async function fetchAllBanks(): Promise<BankRecord[]> {
  const now = Date.now();
  const CACHE_TTL = 86_400_000;

  if (cachedBanks && now < cachedBanks.expiresAt) {
    return cachedBanks.data;
  }

  const res = await fetch(GC_CSV_URL, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`Failed to fetch banks CSV: ${res.status}`);

  const csv = await res.text();
  const parsed = Papa.parse<ParsedRow>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const seen = new Set<string>();
  const banks: BankRecord[] = [];

  for (const row of parsed.data) {
    const name = row.Name?.trim();
    if (!name) continue;

    const countriesRaw = row.Countries ?? "";
    const countryList = countriesRaw
      .split(/[\s,]+/)
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length === 2);

    const isEeeUk = countryList.some((c) => EEE_UK.has(c));
    if (!isEeeUk) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    banks.push({
      id: row.Institution_id?.trim() ?? key,
      name,
      bic: row.SWIFT?.trim() ?? "",
      countries: countryList,
    });
  }

  cachedBanks = { data: banks, expiresAt: now + CACHE_TTL };
  return banks;
}

export function normalizeBankName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LOGO_CACHE_TTL = 86_400_000;

interface LogoCacheEntry {
  url: string | null;
  expiresAt: number;
}

const logoCache: Map<string, LogoCacheEntry> = new Map();

async function searchLogoDevDomain(
  normalizedName: string
): Promise<string | null> {
  const secretKey = process.env.LOGO_DEV_SECRET_KEY;
  if (!secretKey) return null;

  try {
    const q = normalizedName.split(" ").slice(0, 3).join(" ");
    const res = await fetch(
      `https://api.logo.dev/search?q=${encodeURIComponent(q)}&strategy=match`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) return null;

    const results = (await res.json()) as Array<{ name: string; domain: string }>;
    if (!results || results.length === 0) return null;

    return results[0].domain ?? null;
  } catch {
    return null;
  }
}

export async function getBankLogoUrl(
  bank: BankRecord
): Promise<string | null> {
  const cacheKey = normalizeBankName(bank.name);
  const now = Date.now();

  const cached = logoCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return cached.url;
  }

  const domain = await searchLogoDevDomain(cacheKey);
  const publishableKey = process.env.LOGO_DEV_PUBLISHABLE_KEY;

  let url: string | null = null;
  if (domain && publishableKey) {
    url = `https://img.logo.dev/${domain}?token=${publishableKey}&size=128&format=webp&retina=true&fallback=404`;
  }

  logoCache.set(cacheKey, { url, expiresAt: now + LOGO_CACHE_TTL });
  return url;
}

const bankNameById: Map<string, string> = new Map();
let bankNameByIdLoaded = false;

async function ensureBankNameById(): Promise<void> {
  if (bankNameByIdLoaded) return;
  const banks = await fetchAllBanks();
  for (const bank of banks) {
    bankNameById.set(bank.id, bank.name);
  }
  bankNameByIdLoaded = true;
}

export async function getBankLogoByInstitutionId(
  institutionId: string
): Promise<string | null> {
  await ensureBankNameById();
  const name = bankNameById.get(institutionId);
  if (!name) return null;

  const banks = await fetchAllBanks();
  const bank = banks.find((b) => b.id === institutionId);
  if (!bank) return null;

  return getBankLogoUrl(bank);
}

export async function getBankLogosByInstitutionIds(
  institutionIds: string[]
): Promise<Record<string, string>> {
  await ensureBankNameById();
  const banks = await fetchAllBanks();
  const bankMap = new Map(banks.map((b) => [b.id, b]));

  const results: Record<string, string> = {};
  await Promise.all(
    institutionIds.map(async (id) => {
      const bank = bankMap.get(id);
      if (!bank) return;
      const url = await getBankLogoUrl(bank);
      if (url) results[id] = url;
    })
  );
  return results;
}
