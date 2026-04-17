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
  referenceBalance: number | null;
  referenceBalanceDate: Date | null;
  currency: string;
  ownerUserId?: string;
}) {
  const parsed = accountFormSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const ctx = await getWorkspaceContext();

  const hasReferenceBalance = data.referenceBalance !== null && data.referenceBalance !== undefined;

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
      referenceBalance: data.referenceBalance ?? 0,
      referenceBalanceDate: hasReferenceBalance ? (data.referenceBalanceDate ?? new Date()) : null,
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
    referenceBalance: number | null;
    referenceBalanceDate: Date | null;
    currency: string;
  }
) {
  const parsed = accountFormSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

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
      bankInstitutionId: data.bankInstitutionId,
      bankBrandDomain: data.bankBrandDomain,
      accountNumber: data.accountNumber,
      referenceBalance: data.referenceBalance ?? 0,
      referenceBalanceDate: data.referenceBalanceDate,
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
