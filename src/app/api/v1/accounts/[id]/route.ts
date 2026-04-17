import { NextRequest } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyApiKey, requireScope } from "@/lib/api-auth";
import { computeRealBalances } from "@/lib/account-balance";

type AccountType = "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "INVESTMENT" | "OTHER";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = await verifyApiKey(request.headers.get("Authorization"));
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireScope(authCtx, "accounts.write");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { id: authCtx.apiKeyId },
    select: { workspaceId: true },
  });
  if (!apiKey) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const workspaceId = apiKey.workspaceId;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const existing = await prisma.bankAccount.findFirst({
    where: { id, workspaceId },
  });

  if (!existing) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  const referenceBalanceDate = body.referenceBalanceDate !== undefined
    ? (body.referenceBalanceDate ? new Date(body.referenceBalanceDate) : null)
    : undefined;

  const updated = await prisma.bankAccount.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.type !== undefined && { type: body.type as AccountType }),
      ...(body.bankName !== undefined && { bankName: body.bankName }),
      ...(body.bankInstitutionId !== undefined && { bankInstitutionId: body.bankInstitutionId }),
      ...(body.accountNumber !== undefined && { accountNumber: body.accountNumber }),
      ...(body.referenceBalance !== undefined && { referenceBalance: body.referenceBalance }),
      ...(referenceBalanceDate !== undefined && { referenceBalanceDate }),
      ...(body.currency !== undefined && { currency: body.currency }),
    },
  });

  const realBalances = await computeRealBalances(workspaceId, [id]);

  return Response.json({
    id: updated.id,
    name: updated.name,
    bankName: updated.bankName,
    bankInstitutionId: updated.bankInstitutionId,
    referenceBalance: updated.referenceBalance?.toString() ?? null,
    referenceBalanceDate: updated.referenceBalanceDate?.toISOString() ?? null,
    currentBalance: (realBalances.get(id) ?? 0).toFixed(2),
    currency: updated.currency,
    isActive: updated.isActive,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = await verifyApiKey(request.headers.get("Authorization"));
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireScope(authCtx, "accounts.write");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { id: authCtx.apiKeyId },
    select: { workspaceId: true },
  });
  if (!apiKey) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const workspaceId = apiKey.workspaceId;

  const { id } = await params;

  const account = await prisma.bankAccount.findFirst({
    where: { id, workspaceId },
    include: { _count: { select: { transactions: true } } },
  });

  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  await prisma.bankAccount.delete({ where: { id } });

  return Response.json({ success: true });
}
