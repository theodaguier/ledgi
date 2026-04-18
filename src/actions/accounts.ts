"use server";

import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/workspace";
import { accountFormSchema } from "@/lib/validation/schemas";

type AccountType = "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "INVESTMENT" | "OTHER";

export async function createAccount(data: {
  name: string;
  type: string;
  bankName: string | null;
  bankInstitutionId: string | null;
  bankBrandDomain: string | null;
  accountNumber: string | null;
  referenceBalance: string | null;
  referenceBalanceDate: string | null;
  currency: string;
  ownerUserId?: string;
}) {
  const ctx = await getWorkspaceContext();

  const parsed = accountFormSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const referenceBalance = data.referenceBalance && data.referenceBalance.trim() !== "" ? parseFloat(data.referenceBalance) : null;
  const hasReferenceBalance = referenceBalance !== null && !isNaN(referenceBalance);
  const referenceBalanceDate = hasReferenceBalance ? new Date() : null;

  await prisma.bankAccount.create({
    data: {
      workspaceId: ctx.workspaceId,
      ownerUserId: data.ownerUserId ?? ctx.userId,
      name: data.name,
      type: data.type as AccountType,
      bankName: data.bankName,
      bankInstitutionId: data.bankInstitutionId,
      bankBrandDomain: data.bankBrandDomain,
      accountNumber: data.accountNumber,
      referenceBalance,
      referenceBalanceDate,
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
    bankInstitutionId: string | null;
    bankBrandDomain: string | null;
    accountNumber: string | null;
    referenceBalance: string | null;
    referenceBalanceDate: string | null;
    currency: string;
  }
) {
  const ctx = await getWorkspaceContext();

  const parsed = accountFormSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, workspaceId: ctx.workspaceId },
  });

  if (!account) throw new Error("Compte non trouvé");

  const newReferenceBalance = data.referenceBalance && data.referenceBalance.trim() !== "" ? parseFloat(data.referenceBalance) : null;
  const oldReferenceBalance = account.referenceBalance ? account.referenceBalance.toNumber() : null;

  let referenceBalance: number | null;
  let referenceBalanceDate: Date | null;

  if (newReferenceBalance === null) {
    referenceBalance = null;
    referenceBalanceDate = null;
  } else if (newReferenceBalance !== oldReferenceBalance) {
    referenceBalance = newReferenceBalance;
    referenceBalanceDate = new Date();
  } else {
    referenceBalance = account.referenceBalance ? account.referenceBalance.toNumber() : null;
    referenceBalanceDate = account.referenceBalanceDate;
  }

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: {
      name: data.name,
      type: data.type as AccountType,
      bankName: data.bankName,
      bankInstitutionId: data.bankInstitutionId,
      bankBrandDomain: data.bankBrandDomain,
      accountNumber: data.accountNumber,
      referenceBalance,
      referenceBalanceDate,
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
