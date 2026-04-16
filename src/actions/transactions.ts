"use server";

import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { normalizeLabel } from "@/lib/categorization";
import { TransactionType } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/workspace";

export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string | null
) {
  const ctx = await getWorkspaceContext();

  const txRecord = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      workspaceId: ctx.workspaceId,
    },
  });

  if (!txRecord) throw new Error("Transaction not found");

  const normalizedLabel = txRecord.labelNormalized ?? normalizeLabel(txRecord.label);
  const txType: TransactionType = txRecord.type;

  await prisma.$transaction(async (p) => {
    await p.transaction.update({
      where: { id: transactionId },
      data: {
        categoryId,
        categoryManual: categoryId,
      },
    });

    if (categoryId === null) {
      await p.manualLabelCategory.deleteMany({
        where: { workspaceId: ctx.workspaceId, labelNormalized: normalizedLabel, type: txType },
      });
    } else {
      await p.manualLabelCategory.upsert({
        where: {
          workspaceId_labelNormalized_type: {
            workspaceId: ctx.workspaceId,
            labelNormalized: normalizedLabel,
            type: txType,
          },
        },
        create: {
          workspaceId: ctx.workspaceId,
          labelNormalized: normalizedLabel,
          type: txType,
          categoryId,
        },
        update: { categoryId, updatedAt: new Date() },
      });
    }
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function bulkUpdateCategory(
  transactionIds: string[],
  categoryId: string | null
) {
  const ctx = await getWorkspaceContext();

  const transactions = await prisma.transaction.findMany({
    where: {
      id: { in: transactionIds },
      workspaceId: ctx.workspaceId,
    },
    select: { id: true, labelNormalized: true, label: true, type: true },
  });

  await prisma.$transaction(async (p) => {
    await p.transaction.updateMany({
      where: {
        id: { in: transactionIds },
        workspaceId: ctx.workspaceId,
      },
      data: { categoryId, categoryManual: categoryId },
    });

    const uniquePairs = Array.from(
      new Map(
        transactions.map((t) => [
          `${t.labelNormalized ?? ""}|${t.type}`,
          {
            labelNormalized: t.labelNormalized ?? normalizeLabel(t.label),
            type: t.type as TransactionType,
          },
        ])
      ).values()
    );

    if (categoryId === null) {
      await p.manualLabelCategory.deleteMany({
        where: {
          workspaceId: ctx.workspaceId,
          OR: uniquePairs.map((pair) => ({
            labelNormalized: pair.labelNormalized,
            type: pair.type,
          })),
        },
      });
    } else {
      for (const pair of uniquePairs) {
        await p.manualLabelCategory.upsert({
          where: {
            workspaceId_labelNormalized_type: {
              workspaceId: ctx.workspaceId,
              labelNormalized: pair.labelNormalized,
              type: pair.type,
            },
          },
          create: {
            workspaceId: ctx.workspaceId,
            labelNormalized: pair.labelNormalized,
            type: pair.type,
            categoryId,
          },
          update: { categoryId, updatedAt: new Date() },
        });
      }
    }
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function deleteTransaction(transactionId: string) {
  const ctx = await getWorkspaceContext();

  await prisma.transaction.deleteMany({
    where: {
      id: transactionId,
      workspaceId: ctx.workspaceId,
    },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function createRuleFromTransaction(
  transactionId: string,
  categoryId: string
) {
  const ctx = await getWorkspaceContext();

  const tx = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      workspaceId: ctx.workspaceId,
    },
  });

  if (!tx) throw new Error("Transaction not found");

  const keywords = tx.labelNormalized
    ? tx.labelNormalized.split(" ").slice(0, 3).join(" ")
    : tx.label.split(" ").slice(0, 3).join(" ");

  const existingRules = await prisma.categorizationRule.count({
    where: { workspaceId: ctx.workspaceId },
  });

  await prisma.categorizationRule.create({
    data: {
      workspaceId: ctx.workspaceId,
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
