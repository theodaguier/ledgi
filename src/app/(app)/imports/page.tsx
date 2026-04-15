import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/auth";
import ImportsPageClient from "./page-client";

export default async function ImportsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const [imports, accounts] = await Promise.all([
    prisma.importBatch.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { bankAccount: true },
    }),
    prisma.bankAccount.findMany({
      where: { userId: session.user.id, isActive: true },
    }),
  ]);

  return <ImportsPageClient imports={imports as any} accounts={accounts} />;
}
