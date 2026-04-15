"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createAccount(data: {
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  balance: number | null;
  currency: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  await prisma.bankAccount.create({
    data: {
      userId: session.user.id,
      name: data.name,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      balance: data.balance ?? 0,
      currency: data.currency,
    },
  });

  revalidatePath("/accounts");
}

export async function updateAccount(
  accountId: string,
  data: {
    name: string;
    bankName: string | null;
    accountNumber: string | null;
    balance: number | null;
    currency: string;
  }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
  });

  if (!account) throw new Error("Compte non trouvé");

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: {
      name: data.name,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      balance: data.balance ?? 0,
      currency: data.currency,
    },
  });

  revalidatePath("/accounts");
}

export async function deleteAccount(accountId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
    include: { _count: { select: { transactions: true } } },
  });

  if (!account) throw new Error("Compte non trouvé");
  if (account._count.transactions > 0) throw new Error("Impossible de supprimer un compte avec des transactions");

  await prisma.bankAccount.delete({
    where: { id: accountId },
  });

  revalidatePath("/accounts");
}
