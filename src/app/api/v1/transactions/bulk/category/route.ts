import { NextRequest } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyApiKey, requireScope } from "@/lib/api-auth";
import { normalizeLabel } from "@/lib/categorization";
import { TransactionType } from "@prisma/client";

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null);

  if (
    !body ||
    !Array.isArray(body.transactionIds) ||
    body.transactionIds.length === 0
  ) {
    return Response.json(
      { error: "Invalid body: transactionIds array required" },
      { status: 400 }
    );
  }

  const categoryId = body.categoryId === null ? null : body.categoryId;

  const transactions = await prisma.transaction.findMany({
    where: { id: { in: body.transactionIds }, bankAccount: { workspaceId } },
    select: { id: true, labelNormalized: true, label: true, type: true },
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

  await prisma.$transaction(async (p) => {
    await p.transaction.updateMany({
      where: { id: { in: body.transactionIds }, bankAccount: { workspaceId } },
      data: { categoryId, categoryManual: categoryId },
    });

    if (categoryId === null) {
      await p.manualLabelCategory.deleteMany({
        where: {
          workspaceId,
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
            workspaceId_labelNormalized_type: { workspaceId, labelNormalized: pair.labelNormalized, type: pair.type },
          },
          create: { workspaceId, labelNormalized: pair.labelNormalized, type: pair.type, categoryId },
          update: { categoryId, updatedAt: new Date() },
        });
      }
    }
  });

  return Response.json({ updatedCount: transactions.length });
}
