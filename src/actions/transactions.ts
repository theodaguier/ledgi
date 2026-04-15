"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string | null
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  const tx = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      bankAccount: { userId: session.user.id },
    },
  });

  if (!tx) throw new Error("Transaction not found");

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { categoryId },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function bulkUpdateCategory(
  transactionIds: string[],
  categoryId: string | null
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  await prisma.transaction.updateMany({
    where: {
      id: { in: transactionIds },
      bankAccount: { userId: session.user.id },
    },
    data: { categoryId },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function deleteTransaction(transactionId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  await prisma.transaction.deleteMany({
    where: {
      id: transactionId,
      bankAccount: { userId: session.user.id },
    },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function createRuleFromTransaction(
  transactionId: string,
  categoryId: string
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Not authenticated");

  const tx = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      bankAccount: { userId: session.user.id },
    },
  });

  if (!tx) throw new Error("Transaction not found");

  const keywords = tx.labelNormalized
    ? tx.labelNormalized.split(" ").slice(0, 3).join(" ")
    : tx.label.split(" ").slice(0, 3).join(" ");

  const existingRules = await prisma.categorizationRule.count({
    where: { userId: session.user.id },
  });

  await prisma.categorizationRule.create({
    data: {
      userId: session.user.id,
      name: `Règle: ${tx.label.slice(0, 30)}`,
      priority: existingRules,
      matchType: "CONTAINS",
      pattern: keywords,
      categoryId,
      isActive: true,
      description: `Créée depuis transaction: ${tx.label}`,
    },
  });

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { categoryId },
  });

  revalidatePath("/transactions");
  revalidatePath("/rules");
  revalidatePath("/dashboard");

  return { success: true };
}
