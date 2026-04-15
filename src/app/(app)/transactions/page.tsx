import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/auth";
import TransactionsTable from "./page-client";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; uncategorized?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;

  const transactionsRaw = await prisma.transaction.findMany({
    where: { bankAccount: { userId: session.user.id } },
    orderBy: { dateOperation: "desc" },
    take: 200,
    include: {
      category: { select: { id: true, name: true, slug: true } },
      bankAccount: { select: { name: true } },
    },
  });

  const transactions = transactionsRaw.map((tx) => ({
    ...tx,
    amount: Number(tx.amount),
    dateOperation: tx.dateOperation.toISOString(),
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  }));

  const categories = await prisma.category.findMany({
    where: { OR: [{ userId: session.user.id }, { isSystem: true }] },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {transactions.length} transaction{transactions.length > 1 ? "s" : ""} enregistrées
        </p>
      </div>

      <TransactionsTable
        transactions={transactions as any}
        categories={categories}
        searchParams={params}
      />
    </div>
  );
}
