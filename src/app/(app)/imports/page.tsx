import { prisma } from "@/lib/auth";
import { ImportStatus, Prisma } from "@prisma/client";
import type { Metadata } from "next";
import ImportsPageClient from "./page-client";
import { getWorkspaceContext, listWorkspaceMembers } from "@/lib/workspace";

type ImportsSearchParams = Promise<{
  q?: string | string[];
  status?: string | string[];
  account?: string | string[];
  user?: string | string[];
}>;

function getSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export const metadata: Metadata = {
  title: "Imports",
};

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: ImportsSearchParams;
}) {
  const ctx = await getWorkspaceContext();
  const [members, accounts] = await Promise.all([
    listWorkspaceMembers(ctx.workspaceId),
    prisma.bankAccount.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      select: { id: true, name: true, bankName: true },
    }),
  ]);

  const rawParams = await searchParams;
  const rawStatus = getSearchParam(rawParams.status);
  const rawAccount = getSearchParam(rawParams.account);
  const rawUser = getSearchParam(rawParams.user);
  const validStatuses = Object.values(ImportStatus) as string[];
  const accountIds = new Set(accounts.map((a) => a.id));
  const userIds = new Set(members.map((m) => m.userId));

  const params = {
    q: getSearchParam(rawParams.q)?.trim() || undefined,
    status: validStatuses.includes(rawStatus ?? "") ? rawStatus : undefined,
    account: rawAccount && accountIds.has(rawAccount) ? rawAccount : undefined,
    user: rawUser && userIds.has(rawUser) ? rawUser : undefined,
  };

  const statusFilter = params.status
    ? Object.values(ImportStatus).find((status) => status === params.status)
    : undefined;

  const where: Prisma.ImportBatchWhereInput = {
    workspaceId: ctx.workspaceId,
    ...(params.user ? { createdByUserId: params.user } : {}),
    ...(params.q
      ? {
          OR: [
            {
              fileName: {
                contains: params.q,
                mode: "insensitive" as const,
              },
            },
            {
              formatDetected: {
                contains: params.q,
                mode: "insensitive" as const,
              },
            },
            {
              bankAccount: {
                name: {
                  contains: params.q,
                  mode: "insensitive" as const,
                },
              },
            },
          ],
        }
      : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(params.account ? { bankAccountId: params.account } : {}),
  };

  const filteredImports = await prisma.importBatch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      fileName: true,
      formatDetected: true,
      status: true,
      totalRows: true,
      importedCount: true,
      skippedCount: true,
      errorCount: true,
      createdAt: true,
      createdByUserId: true,
      bankAccount: {
        select: { id: true, name: true, bankName: true },
      },
    },
  });

  const serializedImports = filteredImports.map((importBatch) => ({
    ...importBatch,
    createdAt: importBatch.createdAt.toISOString(),
  }));

  return (
    <ImportsPageClient
      imports={serializedImports}
      accounts={accounts}
      searchParams={params}
      members={members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
      }))}
    />
  );
}
