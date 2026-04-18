"use server";

import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { normalizeLabel, buildGroupKey } from "@/lib/categorization";
import { Prisma, TransactionType } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/workspace";

export interface SimilarTransaction {
  id: string;
  dateOperation: string;
  label: string;
  merchant: string | null;
  amount: number;
  currency: string;
  type: string;
  category: { id: string; name: string; slug: string; color: string | null; icon: string | null } | null;
  bankAccount: { id: string; name: string };
  confidence: number;
}

export interface TransactionDetails {
  id: string;
  dateOperation: string;
  dateValue: string | null;
  label: string;
  labelNormalized: string | null;
  merchant: string | null;
  amount: number;
  currency: string;
  type: string;
  isAutomatic: boolean;
  confidence: number;
  categoryManual: string | null;
  createdAt: string;
  bankAccount: {
    id: string;
    name: string;
    bankName: string | null;
    type: string;
  };
  ownerUser: { id: string; name: string | null; email: string; image: string | null } | null;
  category: { id: string; name: string; slug: string; color: string | null; icon: string | null } | null;
  similarHistory: SimilarTransaction[];
  note: string | null;
  pinned: boolean;
}

export async function getTransactionDetails(transactionId: string): Promise<TransactionDetails | null> {
  const ctx = await getWorkspaceContext();

  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, workspaceId: ctx.workspaceId },
    include: {
      category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
      bankAccount: { select: { id: true, name: true, bankName: true, type: true } },
      ownerUser: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  if (!tx) return null;

  const normalizedLabel = tx.labelNormalized ?? normalizeLabel(tx.label);
  const txType = tx.type;
  const groupKey = tx.groupKey ?? buildGroupKey(tx.label, Number(tx.amount), tx.type, tx.currency);

  const similarWhere: Prisma.TransactionWhereInput = groupKey
    ? {
        workspaceId: ctx.workspaceId,
        groupKey: groupKey,
        type: txType,
      }
    : {
        workspaceId: ctx.workspaceId,
        labelNormalized: normalizedLabel,
        type: txType,
      };

  const similar = await prisma.transaction.findMany({
    where: similarWhere,
    orderBy: { dateOperation: "desc" },
    take: 30,
    select: {
      id: true,
      dateOperation: true,
      label: true,
      merchant: true,
      amount: true,
      currency: true,
      type: true,
      confidence: true,
      category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
      bankAccount: { select: { id: true, name: true } },
    },
  });

  return {
    id: tx.id,
    dateOperation: tx.dateOperation.toISOString(),
    dateValue: tx.dateValue?.toISOString() ?? null,
    label: tx.label,
    labelNormalized: tx.labelNormalized,
    merchant: tx.merchant,
    amount: Number(tx.amount),
    currency: tx.currency,
    type: tx.type,
    isAutomatic: tx.isAutomatic,
    confidence: tx.confidence,
    categoryManual: tx.categoryManual,
    createdAt: tx.createdAt.toISOString(),
    bankAccount: {
      id: tx.bankAccount.id,
      name: tx.bankAccount.name,
      bankName: tx.bankAccount.bankName,
      type: tx.bankAccount.type,
    },
    ownerUser: tx.ownerUser
      ? { id: tx.ownerUser.id, name: tx.ownerUser.name, email: tx.ownerUser.email, image: tx.ownerUser.image }
      : null,
    category: tx.category,
    note: tx.note,
    pinned: tx.pinned,
    similarHistory: similar.map((s) => ({
      id: s.id,
      dateOperation: s.dateOperation.toISOString(),
      label: s.label,
      merchant: s.merchant,
      amount: Number(s.amount),
      currency: s.currency,
      type: s.type,
      confidence: s.confidence,
      category: s.category,
      bankAccount: s.bankAccount,
    })),
  };
}

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
  const groupKey = txRecord.groupKey ?? buildGroupKey(txRecord.label, Number(txRecord.amount), txRecord.type, txRecord.currency);

  const similarCount = await prisma.$transaction(async (p) => {
    await p.transaction.update({
      where: { id: transactionId },
      data: {
        categoryId,
        categoryManual: categoryId,
        groupKey: groupKey ?? undefined,
      },
    });

    const similarWhere: Prisma.TransactionWhereInput = groupKey
      ? {
          id: { not: transactionId },
          workspaceId: ctx.workspaceId,
          groupKey: groupKey,
          type: txType,
        }
      : {
          id: { not: transactionId },
          workspaceId: ctx.workspaceId,
          labelNormalized: normalizedLabel,
          type: txType,
        };

    const similarResult = await p.transaction.updateMany({
      where: similarWhere,
      data: { categoryId, categoryManual: categoryId },
    });

    if (categoryId === null) {
      if (groupKey) {
        await p.manualLabelCategory.deleteMany({
          where: { workspaceId: ctx.workspaceId, groupKey: groupKey, type: txType },
        });
      }
      await p.manualLabelCategory.deleteMany({
        where: { workspaceId: ctx.workspaceId, labelNormalized: normalizedLabel, type: txType },
      });
    } else {
      if (groupKey) {
        await p.manualLabelCategory.upsert({
          where: {
            workspaceId_groupKey_type: {
              workspaceId: ctx.workspaceId,
              groupKey: groupKey,
              type: txType,
            },
          },
          create: {
            workspaceId: ctx.workspaceId,
            labelNormalized: normalizedLabel,
            groupKey: groupKey,
            type: txType,
            categoryId,
          },
          update: { categoryId, updatedAt: new Date() },
        });
      }
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

    return similarResult.count;
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");

  return { similarUpdated: similarCount };
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
    select: { id: true, labelNormalized: true, label: true, type: true, amount: true, currency: true, groupKey: true },
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

    const uniqueGroups = Array.from(
      new Map(
        transactions
          .filter((t) => t.groupKey)
          .map((t) => [
            `${t.groupKey ?? ""}|${t.type}`,
            {
              groupKey: t.groupKey!,
              type: t.type as TransactionType,
            },
          ])
      ).values()
    );

    if (categoryId === null) {
      if (uniqueGroups.length > 0) {
        await p.manualLabelCategory.deleteMany({
          where: {
            workspaceId: ctx.workspaceId,
            OR: uniqueGroups.map((group) => ({
              groupKey: group.groupKey,
              type: group.type,
            })),
          },
        });
      }
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
      for (const group of uniqueGroups) {
        const tx = transactions.find((t) => t.groupKey === group.groupKey);
        if (!tx) continue;
        await p.manualLabelCategory.upsert({
          where: {
            workspaceId_groupKey_type: {
              workspaceId: ctx.workspaceId,
              groupKey: group.groupKey,
              type: group.type,
            },
          },
          create: {
            workspaceId: ctx.workspaceId,
            labelNormalized: tx.labelNormalized ?? normalizeLabel(tx.label),
            groupKey: group.groupKey,
            type: group.type,
            categoryId,
          },
          update: { categoryId, updatedAt: new Date() },
        });
      }
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

export async function updateTransactionMetadata(
  transactionId: string,
  data: { note?: string | null; pinned?: boolean }
) {
  const ctx = await getWorkspaceContext();

  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });

  if (!tx) throw new Error("Transaction not found");

  const updateData: Prisma.TransactionUpdateInput = {};
  if ("note" in data) updateData.note = data.note ?? null;
  if ("pinned" in data) updateData.pinned = data.pinned;

  await prisma.transaction.update({
    where: { id: transactionId },
    data: updateData,
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");

  return { success: true };
}
