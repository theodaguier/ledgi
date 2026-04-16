import { NextRequest } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyApiKey, requireScope } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const authCtx = await verifyApiKey(request.headers.get("Authorization"));
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireScope(authCtx, "summary.read");
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

  const { searchParams } = new URL(request.url);
  const rawPreset = searchParams.get("preset") ?? undefined;
  const rawFrom = searchParams.get("from") ?? undefined;
  const rawTo = searchParams.get("to") ?? undefined;
  const rawUser = searchParams.get("user") ?? undefined;

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  let rangeStart: Date;
  let rangeEnd: Date;

  if (rawPreset === "month") {
    rangeStart = startOfMonth;
    rangeEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (rawPreset === "last7d") {
    rangeStart = new Date(today);
    rangeStart.setDate(today.getDate() - 6);
    rangeEnd = today;
  } else if (rawPreset === "today") {
    rangeStart = new Date(today);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = today;
  } else {
    const fromStr = rawFrom ?? undefined;
    const toStr = rawTo ?? undefined;
    if (fromStr) {
      const fromParts = fromStr.split("-").map(Number);
      rangeStart = new Date(fromParts[0], fromParts[1] - 1, fromParts[2]);
    } else {
      rangeStart = startOfMonth;
    }
    if (toStr) {
      const toParts = toStr.split("-").map(Number);
      rangeEnd = new Date(toParts[0], toParts[1] - 1, toParts[2]);
      rangeEnd.setDate(rangeEnd.getDate() + 1);
    } else {
      rangeEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    }
  }

  const [currentExpenses, currentIncome, currentTransfers, uncategorizedCount] =
    await Promise.all([
      prisma.transaction.aggregate({
        where: {
          bankAccount: { workspaceId },
          ...(rawUser ? { ownerUserId: rawUser } : {}),
          dateOperation: { gte: rangeStart, lt: rangeEnd },
          type: "DEBIT",
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          bankAccount: { workspaceId },
          ...(rawUser ? { ownerUserId: rawUser } : {}),
          dateOperation: { gte: rangeStart, lt: rangeEnd },
          type: "CREDIT",
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          bankAccount: { workspaceId },
          ...(rawUser ? { ownerUserId: rawUser } : {}),
          dateOperation: { gte: rangeStart, lt: rangeEnd },
          type: "TRANSFER",
        },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: {
          bankAccount: { workspaceId },
          ...(rawUser ? { ownerUserId: rawUser } : {}),
          categoryId: null,
        },
      }),
    ]);

  const expensesNum = Number(currentExpenses._sum.amount ?? 0);
  const incomeNum = Number(currentIncome._sum.amount ?? 0);
  const transfersNum = Number(currentTransfers._sum.amount ?? 0);

  return Response.json({
    period: {
      preset: rawPreset ?? "month",
      from: rangeStart.toISOString(),
      to: rangeEnd.toISOString(),
    },
    expenses: expensesNum,
    income: incomeNum,
    transfers: transfersNum,
    netBalance: incomeNum - expensesNum,
    uncategorizedCount,
  });
}
