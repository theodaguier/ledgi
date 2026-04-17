import { prisma } from "@/lib/auth";

export async function computeRealBalances(
  workspaceId: string,
  accountIds?: string[]
): Promise<Map<string, number>> {
  const accounts = await prisma.bankAccount.findMany({
    where: {
      workspaceId,
      ...(accountIds ? { id: { in: accountIds } } : {}),
    },
    select: { id: true, referenceBalance: true, referenceBalanceDate: true },
  });

  const balanceMap = new Map<string, number>();
  for (const acc of accounts) {
    balanceMap.set(acc.id, acc.referenceBalance?.toNumber() ?? 0);
  }

  if (accounts.length === 0) return balanceMap;

  for (const acc of accounts) {
    const afterDate = acc.referenceBalanceDate;
    const base = balanceMap.get(acc.id) ?? 0;

    const txAggregates = await prisma.transaction.groupBy({
      by: ["type"],
      where: {
        bankAccountId: acc.id,
        ...(afterDate ? { dateOperation: { gt: afterDate } } : {}),
      },
      _sum: { amount: true },
    });

    let delta = 0;
    for (const row of txAggregates) {
      const amount = row._sum.amount?.toNumber() ?? 0;
      switch (row.type) {
        case "CREDIT":
          delta += amount;
          break;
        case "DEBIT":
        case "FEE":
        case "TRANSFER":
          delta -= amount;
          break;
      }
    }

    balanceMap.set(acc.id, base + delta);
  }

  return balanceMap;
}
