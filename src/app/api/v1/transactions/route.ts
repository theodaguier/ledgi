import { NextRequest } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyApiKey, requireScope } from "@/lib/api-auth";
import {
  getSearchParam,
  isTransactionDatePreset,
  isTransactionSort,
  normalizeDateParams,
  getTransactionDateRange,
  type TransactionSort,
} from "@/app/(app)/transactions/filter-utils";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const authCtx = await verifyApiKey(request.headers.get("Authorization"));
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireScope(authCtx, "transactions.read");
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

  const { searchParams } = new URL(request.url);

  const rawPreset = getSearchParam(searchParams.get("preset") ?? undefined);
  const rawSort = getSearchParam(searchParams.get("sort") ?? undefined);
  const rawFrom = getSearchParam(searchParams.get("from") ?? undefined);
  const rawTo = getSearchParam(searchParams.get("to") ?? undefined);
  const rawCategory = getSearchParam(searchParams.get("category") ?? undefined);
  const rawAccount = getSearchParam(searchParams.get("account") ?? undefined);
  const rawUser = getSearchParam(searchParams.get("user") ?? undefined);
  const rawQ = getSearchParam(searchParams.get("q") ?? undefined);
  const rawLimit = searchParams.get("limit");
  const rawOffset = searchParams.get("offset");

  const preset = isTransactionDatePreset(rawPreset) ? rawPreset : undefined;
  const sort: TransactionSort = isTransactionSort(rawSort) ? rawSort : "desc";
  const normalized = preset ? {} : normalizeDateParams(rawFrom, rawTo);
  const dateRange = getTransactionDateRange({
    preset,
    from: normalized.from,
    to: normalized.to,
  });

  const limit = rawLimit ? Math.min(Math.max(1, parseInt(rawLimit, 10)), 200) : 50;
  const offset = rawOffset ? Math.max(0, parseInt(rawOffset, 10)) : 0;

  const accountIds = rawAccount
    ? await prisma.bankAccount
        .findMany({
          where: { workspaceId, id: rawAccount },
          select: { id: true },
        })
        .then((rows) => rows.map((r) => r.id))
    : undefined;

  const where: Prisma.TransactionWhereInput = {
    bankAccount: { workspaceId },
    ...(rawUser ? { ownerUserId: rawUser } : {}),
    ...(accountIds ? { bankAccountId: { in: accountIds } } : {}),
    ...(rawQ
      ? {
          OR: [
            { label: { contains: rawQ, mode: "insensitive" as const } },
            { labelNormalized: { contains: rawQ, mode: "insensitive" as const } },
            { merchant: { contains: rawQ, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(rawCategory === "uncategorized"
      ? { categoryId: null }
      : rawCategory
        ? { categoryId: rawCategory }
        : {}),
    ...(dateRange.gte || dateRange.lt
      ? {
          dateOperation: {
            ...(dateRange.gte ? { gte: dateRange.gte } : {}),
            ...(dateRange.lt ? { lt: dateRange.lt } : {}),
          },
        }
      : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { dateOperation: sort },
      take: limit,
      skip: offset,
      include: {
        category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
        bankAccount: { select: { id: true, name: true } },
        ownerUser: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  const data = transactions.map((tx) => ({
    id: tx.id,
    dateOperation: tx.dateOperation.toISOString(),
    label: tx.label,
    labelNormalized: tx.labelNormalized,
    merchant: tx.merchant,
    amount: tx.amount.toString(),
    currency: tx.currency,
    type: tx.type,
    confidence: tx.confidence,
    category: tx.category,
    bankAccount: tx.bankAccount,
    isAutomatic: tx.isAutomatic,
    ownerUserId: tx.ownerUserId,
    createdAt: tx.createdAt.toISOString(),
  }));

  return Response.json({
    data,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + transactions.length < total,
    },
  });
}
