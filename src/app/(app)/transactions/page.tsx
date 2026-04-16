import { prisma } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import { AppPageShell } from "@/components/app-page-shell";
import { AppPageHeader } from "@/components/app-page-header";
import TransactionsTable from "./page-client";
import {
  getSearchParam,
  getTransactionDateRange,
  isTransactionDatePreset,
  isTransactionSort,
  normalizeDateParams,
  type TransactionSort,
} from "./filter-utils";
import { getWorkspaceContext, listWorkspaceMembers } from "@/lib/workspace";

export const metadata: Metadata = {
  title: "Transactions",
};

type TransactionsSearchParams = Promise<{
  q?: string | string[];
  category?: string | string[];
  preset?: string | string[];
  from?: string | string[];
  to?: string | string[];
  sort?: string | string[];
  account?: string | string[];
  user?: string | string[];
}>;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: TransactionsSearchParams;
}) {
  const ctx = await getWorkspaceContext();
  const [members, accounts] = await Promise.all([
    listWorkspaceMembers(ctx.workspaceId),
    prisma.bankAccount.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rawParams = await searchParams;
  const preset = getSearchParam(rawParams.preset);
  const rawSort = getSearchParam(rawParams.sort);
  const normalizedDateParams = preset
    ? {}
    : normalizeDateParams(
        getSearchParam(rawParams.from),
        getSearchParam(rawParams.to)
      );
  const sort: TransactionSort = isTransactionSort(rawSort) ? rawSort : "desc";
  const rawAccount = getSearchParam(rawParams.account);
  const rawUser = getSearchParam(rawParams.user);

  const accountIds = new Set(accounts.map((a) => a.id));
  const userIds = new Set(members.map((m) => m.userId));

  const params = {
    q: getSearchParam(rawParams.q)?.trim() || undefined,
    category: getSearchParam(rawParams.category) || undefined,
    preset: isTransactionDatePreset(preset) ? preset : undefined,
    from: normalizedDateParams.from,
    to: normalizedDateParams.to,
    sort,
    account: rawAccount && accountIds.has(rawAccount) ? rawAccount : undefined,
    user: rawUser && userIds.has(rawUser) ? rawUser : undefined,
  };
  const dateRange = getTransactionDateRange(params);

  const where: Prisma.TransactionWhereInput = {
    bankAccount: { workspaceId: ctx.workspaceId },
    ...(params.account ? { bankAccountId: params.account } : {}),
    ...(params.user ? { ownerUserId: params.user } : {}),
    ...(params.q
      ? {
          OR: [
            {
              label: {
                contains: params.q,
                mode: "insensitive" as const,
              },
            },
            {
              labelNormalized: {
                contains: params.q,
                mode: "insensitive" as const,
              },
            },
            {
              merchant: {
                contains: params.q,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
    ...(params.category === "uncategorized"
      ? { categoryId: null }
      : params.category
        ? { categoryId: params.category }
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

  const transactionsRaw = await prisma.transaction.findMany({
    where,
    orderBy: { dateOperation: params.sort },
    take: 200,
    include: {
      category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
      bankAccount: { select: { id: true, name: true } },
      ownerUser: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const categories = await prisma.category.findMany({
    where: { OR: [{ workspaceId: ctx.workspaceId }, { isSystem: true }] },
    orderBy: { name: "asc" },
  });

  const serializedTransactions = transactionsRaw.map((tx) => ({
    id: tx.id,
    dateOperation: tx.dateOperation.toISOString(),
    label: tx.label,
    labelNormalized: tx.labelNormalized,
    merchant: tx.merchant,
    amount: Number(tx.amount),
    currency: tx.currency,
    type: tx.type,
    confidence: tx.confidence,
    category: tx.category,
    bankAccount: tx.bankAccount,
    ownerUser: tx.ownerUser
      ? { id: tx.ownerUser.id, name: tx.ownerUser.name, email: tx.ownerUser.email, image: tx.ownerUser.image }
      : null,
  }));

  return (
    <AppPageShell>
      <AppPageHeader
        title="Transactions"
        description={`${serializedTransactions.length} transaction${serializedTransactions.length > 1 ? "s" : ""} enregistrées`}
      />
      <TransactionsTable
        transactions={serializedTransactions}
        categories={categories}
        searchParams={params}
        members={members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          user: {
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            image: m.user.image,
          },
        }))}
      />
    </AppPageShell>
  );
}
