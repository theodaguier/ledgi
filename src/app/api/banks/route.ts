import { fetchAllBanks, getBankLogoUrl } from "@/lib/bank-logo-resolver";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").toLowerCase().trim();

  let banks;
  try {
    banks = await fetchAllBanks();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch banks";
    console.error("[banks]", message);
    return Response.json({ error: message, banks: [] }, { status: 502 });
  }

  if (q) {
    banks = banks.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.bic.toLowerCase().includes(q)
    );

    const results = await Promise.all(
      banks.slice(0, 20).map(async (bank) => ({
        ...bank,
        logo: (await getBankLogoUrl(bank)) ?? null,
      }))
    );

    return Response.json({ banks: results });
  }

  return Response.json({ banks });
}
