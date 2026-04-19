import { PrismaClient } from "@prisma/client";
import { buildGroupKey, normalizeLabel } from "../src/lib/categorization";

const prisma = new PrismaClient();

const BATCH_SIZE = 1000;

async function backfillTransactionGroupKeys() {
  console.log("Starting Transaction.groupKey backfill...");

  let totalProcessed = 0;
  let totalUpdated = 0;
  let hasMore = true;
  let lastId: string | null = null;

  while (hasMore) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactions: any = await prisma.transaction.findMany({
      where: {
        groupKey: null,
        ...(lastId ? { id: { gt: lastId } } : {}),
      },
      select: {
        id: true,
        label: true,
        amount: true,
        type: true,
        currency: true,
        labelNormalized: true,
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    });

    if (transactions.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Processing batch of ${transactions.length} transactions...`);

    // Update each transaction in the batch
    for (const tx of transactions) {
      const normalizedLabel = tx.labelNormalized ?? normalizeLabel(tx.label);
      const groupKey = buildGroupKey(
        tx.label,
        Number(tx.amount),
        tx.type,
        tx.currency
      );

      if (groupKey) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            groupKey,
            labelNormalized: normalizedLabel,
          },
        });
        totalUpdated++;
      } else {
        // If no groupKey can be built, at least ensure labelNormalized is set
        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            labelNormalized: normalizedLabel,
          },
        });
      }

      totalProcessed++;
      lastId = tx.id;
    }

    console.log(`Processed ${totalProcessed} transactions, updated ${totalUpdated} with groupKey`);
  }

  console.log(`Backfill complete: ${totalProcessed} transactions processed, ${totalUpdated} updated with groupKey`);
}

async function main() {
  try {
    await backfillTransactionGroupKeys();
  } catch (error) {
    console.error("Backfill failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
