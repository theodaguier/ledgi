import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/auth";
import AccountsPageClient from "./page-client";

export default async function AccountsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const accountsRaw = await prisma.bankAccount.findMany({
    where: { userId: session.user.id },
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
