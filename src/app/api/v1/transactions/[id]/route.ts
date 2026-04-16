import { NextRequest } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyApiKey, requireScope } from "@/lib/api-auth";
import { normalizeLabel } from "@/lib/categorization";
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

  if (!body || typeof body.categoryId !== "string") {
    return Response.json({ error: "Invalid body: categoryId required" }, { status: 400 });
  }

  const tx = await prisma.transaction.findFirst({
    where: { id, bankAccount: { workspaceId } },
    select: { id: true, labelNormalized: true, label: true, type: true },
  });

  if (!tx) {
    return Response.json({ error: "Transaction not found" }, { status: 404 });
  }

  const categoryId = body.categoryId || null;
  const normalizedLabel = tx.labelNormalized ?? normalizeLabel(tx.label);

  const updated = await prisma.$transaction(async (p) => {
    const result = await p.transaction.update({
      where: { id },
      data: { categoryId, categoryManual: categoryId },
      include: {
        category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
        bankAccount: { select: { id: true, name: true } },
      },
    });

    if (categoryId === null) {
      await p.manualLabelCategory.deleteMany({
        where: { workspaceId, labelNormalized: normalizedLabel, type: tx.type as TransactionType },
      });
    } else {
      await p.manualLabelCategory.upsert({
        where: {
          workspaceId_labelNormalized_type: { workspaceId, labelNormalized: normalizedLabel, type: tx.type as TransactionType },
        },
        create: { workspaceId, labelNormalized: normalizedLabel, type: tx.type as TransactionType, categoryId },
        update: { categoryId, updatedAt: new Date() },
      });
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
