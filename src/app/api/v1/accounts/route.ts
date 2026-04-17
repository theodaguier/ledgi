import { NextRequest } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyApiKey, requireScope } from "@/lib/api-auth";
import { computeRealBalances } from "@/lib/account-balance";

export async function GET(request: NextRequest) {
  const authCtx = await verifyApiKey(request.headers.get("Authorization"));
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireScope(authCtx, "accounts.read");
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

  const accounts = await prisma.bankAccount.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      bankName: true,
      bankInstitutionId: true,
      accountNumber: true,
      referenceBalance: true,
      referenceBalanceDate: true,
      currency: true,
      isActive: true,
      createdAt: true,
      _count: { select: { transactions: true } },
    },
  });

  const accountIds = accounts.map((a) => a.id);
  const realBalances = await computeRealBalances(workspaceId, accountIds);

  const data = accounts.map((acc) => ({
    id: acc.id,
    name: acc.name,
    type: acc.type,
    bankName: acc.bankName,
    bankInstitutionId: acc.bankInstitutionId,
    accountNumber: acc.accountNumber,
    referenceBalance: acc.referenceBalance?.toString() ?? null,
    referenceBalanceDate: acc.referenceBalanceDate?.toISOString() ?? null,
    currentBalance: (realBalances.get(acc.id) ?? 0).toFixed(2),
    currency: acc.currency,
    isActive: acc.isActive,
    transactionCount: acc._count.transactions,
    createdAt: acc.createdAt.toISOString(),
  }));

  return Response.json({ data });
}

type AccountType = "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "INVESTMENT" | "OTHER";

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null);

  if (!body || typeof body.name !== "string" || !body.name) {
    return Response.json({ error: "Invalid body: name required" }, { status: 400 });
  }

  const hasReferenceBalance = "referenceBalance" in body;
  const hasReferenceBalanceDate = "referenceBalanceDate" in body;

  const referenceBalanceDate = hasReferenceBalance
    ? (hasReferenceBalanceDate && body.referenceBalanceDate
        ? new Date(body.referenceBalanceDate)
        : new Date())
    : null;

  const account = await prisma.bankAccount.create({
    data: {
      workspaceId,
      name: body.name,
      type: (body.type as AccountType) || "CHECKING",
      bankName: body.bankName ?? null,
      bankInstitutionId: body.bankInstitutionId ?? null,
      accountNumber: body.accountNumber ?? null,
      referenceBalance: typeof body.referenceBalance === "number" ? body.referenceBalance : 0,
      referenceBalanceDate,
      currency: body.currency ?? "EUR",
    },
  });

  return Response.json({
    id: account.id,
    name: account.name,
    type: account.type,
    bankName: account.bankName,
    bankInstitutionId: account.bankInstitutionId,
    accountNumber: account.accountNumber,
    referenceBalance: account.referenceBalance?.toString() ?? null,
    referenceBalanceDate: account.referenceBalanceDate?.toISOString() ?? null,
    currency: account.currency,
    isActive: account.isActive,
    createdAt: account.createdAt.toISOString(),
  }, { status: 201 });
}
