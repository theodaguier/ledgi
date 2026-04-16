import { NextRequest } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyApiKey, requireScope } from "@/lib/api-auth";

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
      accountNumber: true,
      balance: true,
      currency: true,
      isActive: true,
      createdAt: true,
      _count: { select: { transactions: true } },
    },
  });

  const data = accounts.map((acc) => ({
    id: acc.id,
    name: acc.name,
    type: acc.type,
    bankName: acc.bankName,
    accountNumber: acc.accountNumber,
    balance: acc.balance?.toString() ?? null,
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

  const account = await prisma.bankAccount.create({
    data: {
      workspaceId,
      name: body.name,
      type: (body.type as AccountType) || "CHECKING",
      bankName: body.bankName ?? null,
      accountNumber: body.accountNumber ?? null,
      balance: typeof body.balance === "number" ? body.balance : 0,
      currency: body.currency ?? "EUR",
    },
  });

  return Response.json({
    id: account.id,
    name: account.name,
    type: account.type,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    balance: account.balance?.toString() ?? null,
    currency: account.currency,
    isActive: account.isActive,
    createdAt: account.createdAt.toISOString(),
  }, { status: 201 });
}
