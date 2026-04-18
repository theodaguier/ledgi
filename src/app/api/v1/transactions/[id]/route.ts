import { NextRequest } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyApiKey, requireScope } from "@/lib/api-auth";
import { normalizeLabel, buildGroupKey } from "@/lib/categorization";
import { TransactionType } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = await verifyApiKey(request.headers.get("Authorization"));
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireScope(authCtx, "transactions.write");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { id: authCtx.apiKeyId },
    select: { workspaceId: true },
  });
  if (!apiKey) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const workspaceId = apiKey.workspaceId;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const tx = await prisma.transaction.findFirst({
    where: { id, bankAccount: { workspaceId } },
    select: { id: true, labelNormalized: true, label: true, type: true, merchant: true, amount: true, currency: true, groupKey: true },
  });

  if (!tx) {
    return Response.json({ error: "Transaction not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  const hasCategoryUpdate = "categoryId" in body;

  if (hasCategoryUpdate) {
    const categoryId = body.categoryId || null;
    updateData.categoryId = categoryId;
    updateData.categoryManual = categoryId;
  }

  if ("note" in body) {
    updateData.note = body.note ?? null;
  }

  if ("pinned" in body && typeof body.pinned === "boolean") {
    updateData.pinned = body.pinned;
  }

  const normalizedLabel = tx.labelNormalized ?? normalizeLabel(tx.label);
  const groupKey = tx.groupKey ?? buildGroupKey(tx.label, Number(tx.amount), tx.type, tx.currency);

  const updated = await prisma.$transaction(async (p) => {
    const result = await p.transaction.update({
      where: { id },
      data: { ...updateData, groupKey: groupKey ?? undefined },
      include: {
        category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
        bankAccount: { select: { id: true, name: true } },
      },
    });

    if (hasCategoryUpdate) {
      const categoryId = updateData.categoryId as string | null;

      const similarWhere = groupKey
        ? {
            id: { not: id },
            bankAccount: { workspaceId },
            groupKey: groupKey,
            type: tx.type as TransactionType,
          }
        : {
            id: { not: id },
            bankAccount: { workspaceId },
            labelNormalized: normalizedLabel,
            type: tx.type as TransactionType,
          };

      await p.transaction.updateMany({
        where: similarWhere,
        data: { categoryId, categoryManual: categoryId },
      });

      if (categoryId === null) {
        if (groupKey) {
          await p.manualLabelCategory.deleteMany({
            where: { workspaceId, groupKey: groupKey, type: tx.type as TransactionType },
          });
        }
        await p.manualLabelCategory.deleteMany({
          where: { workspaceId, labelNormalized: normalizedLabel, type: tx.type as TransactionType },
        });
      } else {
        if (groupKey) {
          await p.manualLabelCategory.upsert({
            where: {
              workspaceId_groupKey_type: { workspaceId, groupKey: groupKey, type: tx.type as TransactionType },
            },
            create: { workspaceId, labelNormalized: normalizedLabel, groupKey: groupKey, type: tx.type as TransactionType, categoryId },
            update: { categoryId, updatedAt: new Date() },
          });
        }
        await p.manualLabelCategory.upsert({
          where: {
            workspaceId_labelNormalized_type: { workspaceId, labelNormalized: normalizedLabel, type: tx.type as TransactionType },
          },
          create: { workspaceId, labelNormalized: normalizedLabel, type: tx.type as TransactionType, categoryId },
          update: { categoryId, updatedAt: new Date() },
        });
      }
    }

    return result;
  });

  return Response.json({
    id: updated.id,
    dateOperation: updated.dateOperation.toISOString(),
    label: updated.label,
    amount: updated.amount.toString(),
    currency: updated.currency,
    type: updated.type,
    category: updated.category,
    bankAccount: updated.bankAccount,
    note: updated.note,
    pinned: updated.pinned,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = await verifyApiKey(request.headers.get("Authorization"));
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireScope(authCtx, "transactions.write");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { id: authCtx.apiKeyId },
    select: { workspaceId: true },
  });
  if (!apiKey) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const workspaceId = apiKey.workspaceId;

  const { id } = await params;

  const tx = await prisma.transaction.findFirst({
    where: { id, bankAccount: { workspaceId } },
  });

  if (!tx) {
    return Response.json({ error: "Transaction not found" }, { status: 404 });
  }

  await prisma.transaction.delete({ where: { id } });

  return Response.json({ success: true });
}
