import { prisma } from "@/lib/auth";
import type { Metadata } from "next";
import AccountsPageClient from "./page-client";
import { getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = {
  title: "Comptes",
};

export default async function AccountsPage() {
  const ctx = await getWorkspaceContext();

  const accountsRaw = await prisma.bankAccount.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { transactions: true } },
    },
  });

  const accounts = accountsRaw.map((acc) => ({
    ...acc,
    balance: acc.balance ? Number(acc.balance) : null,
  }));

  return <AccountsPageClient accounts={accounts} />;
}
