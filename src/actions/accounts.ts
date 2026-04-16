"use server";

import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/workspace";

type AccountType = "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "INVESTMENT" | "OTHER";

export async function createAccount(data: {
  name: string;
  type: string;
  bankName: string | null;
  accountNumber: string | null;
  balance: number | null;
  currency: string;
  ownerUserId?: string;
}) {
  const ctx = await getWorkspaceContext();

  await prisma.bankAccount.create({
    data: {
      workspaceId: ctx.workspaceId,
      ownerUserId: data.ownerUserId ?? ctx.userId,
      name: data.name,
      type: data.type as AccountType,
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
    type: string;
    bankName: string | null;
    accountNumber: string | null;
    balance: number | null;
    currency: string;
  }
) {
  const ctx = await getWorkspaceContext();

  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, workspaceId: ctx.workspaceId },
  });

  if (!account) throw new Error("Compte non trouvé");

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: {
      name: data.name,
      type: data.type as AccountType,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      balance: data.balance ?? 0,
      currency: data.currency,
    },
  });

  revalidatePath("/accounts");
}

export async function deleteAccount(accountId: string) {
  const ctx = await getWorkspaceContext();

  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, workspaceId: ctx.workspaceId },
    include: { _count: { select: { transactions: true } } },
  });

  if (!account) throw new Error("Compte non trouvé");
  if (account._count.transactions > 0) throw new Error("Impossible de supprimer un compte avec des transactions");

  await prisma.bankAccount.delete({
    where: { id: accountId },
  });

  revalidatePath("/accounts");
}

export async function getAccounts() {
  const ctx = await getWorkspaceContext();

  return prisma.bankAccount.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { transactions: true } },
    },
  });
}
