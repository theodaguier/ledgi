import Papa from "papaparse";

function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const GC_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1EZ5n7QDGaRIot5M86dwqd5UFSGEDTeTRzEq3D9uEDkM/export?format=csv";

const EEE_UK = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI",
  "FR", "DE", "GR", "HU", "IS", "IE", "IT", "LV",
  "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT",
  "RO", "SK", "SI", "ES", "SE", "GB",
]);

interface Bank {
  id: string;
  name: string;
  bic: string;
  countries: string[];
}

interface ParsedRow {
  Name?: string;
  SWIFT?: string;
  Countries?: string;
  Institution_id?: string;
}

async function fetchBanks(): Promise<Bank[]> {
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
  const banks: Bank[] = [];

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

  return banks;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = removeDiacritics((searchParams.get("q") ?? "").toLowerCase().trim());

  let banks: Bank[];
  try {
    banks = await fetchBanks();
  } catch {
    return Response.json({ error: "Failed to fetch banks" }, { status: 502 });
  }

  if (q) {
    banks = banks.filter(
      (b) =>
        removeDiacritics(b.name.toLowerCase()).includes(q) ||
        removeDiacritics(b.bic.toLowerCase()).includes(q)
    );
  }

  return Response.json({ banks });
}
