import { getBankLogosByInstitutionIds } from "@/lib/bank-logo-resolver";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");

  if (!idsParam) {
    return Response.json({ error: "ids query param required" }, { status: 400 });
  }

  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return Response.json({ logos: {} });
  }

  if (ids.length > 100) {
    return Response.json({ error: "max 100 ids" }, { status: 400 });
  }

  try {
    const logos = await getBankLogosByInstitutionIds(ids);
    return Response.json({ logos });
  } catch (err) {
    console.error("[bank-logos]", err);
    return Response.json({ logos: {} }, { status: 500 });
  }
}
