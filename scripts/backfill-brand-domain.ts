import { PrismaClient } from "@prisma/client";
import { normalizeBankName } from "../src/lib/bank-logo-resolver";

const prisma = new PrismaClient();

const BATCH_SIZE = 50;

async function backfillBrandDomains() {
  console.log("Starting BankAccount.bankBrandDomain backfill...");

  const secretKey = process.env.LOGO_DEV_SECRET_KEY;
  if (!secretKey) {
    console.error("LOGO_DEV_SECRET_KEY is required. Set it in your environment.");
    process.exit(1);
  }

  let totalProcessed = 0;
  let totalUpdated = 0;
  let hasMore = true;
  let cursor: string | null = null;

  while (hasMore) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts: any = await prisma.bankAccount.findMany({
      where: {
        bankInstitutionId: { not: null },
        OR: [
          { bankBrandDomain: null },
          { bankBrandDomain: "" },
        ],
      },
      select: {
        id: true,
        bankName: true,
        bankInstitutionId: true,
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (accounts.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Processing batch of ${accounts.length} accounts...`);

    for (const account of accounts) {
      const institutionId: string | null = account.bankInstitutionId;
      const bankName: string | null = account.bankName;

      if (!institutionId && !bankName) {
        cursor = account.id;
        totalProcessed++;
        continue;
      }

      try {
        let domain: string | null = null;

        if (institutionId) {
          const searchQ = institutionId.replace(/_/g, " ").split(" ").slice(0, 3).join(" ");
          const res = await fetch(
            `https://api.logo.dev/search?q=${encodeURIComponent(searchQ)}&strategy=match`,
            {
              headers: {
                Authorization: `Bearer ${secretKey}`,
                Accept: "application/json",
              },
            }
          );

          if (res.ok) {
            const results = (await res.json()) as Array<{ name: string; domain: string }>;
            if (results && results.length > 0 && results[0].domain) {
              domain = results[0].domain;
            }
          }
        }

        if (!domain && bankName) {
          const normalizedName = normalizeBankName(bankName);
          const q = normalizedName.split(" ").slice(0, 3).join(" ");
          const res = await fetch(
            `https://api.logo.dev/search?q=${encodeURIComponent(q)}&strategy=match`,
            {
              headers: {
                Authorization: `Bearer ${secretKey}`,
                Accept: "application/json",
              },
            }
          );

          if (res.ok) {
            const results = (await res.json()) as Array<{ name: string; domain: string }>;
            if (results && results.length > 0 && results[0].domain) {
              domain = results[0].domain;
            }
          }
        }

        if (domain) {
          await prisma.bankAccount.update({
            where: { id: account.id },
            data: { bankBrandDomain: domain },
          });
          totalUpdated++;
          console.log(`  Updated ${bankName ?? institutionId} -> ${domain}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`  Error processing ${bankName ?? institutionId}:`, err);
      }

      cursor = account.id;
      totalProcessed++;
    }

    console.log(`Processed ${totalProcessed} accounts, updated ${totalUpdated} with brandDomain`);
  }

  console.log(`Backfill complete: ${totalProcessed} accounts processed, ${totalUpdated} updated with brandDomain`);
}

async function main() {
  try {
    await backfillBrandDomains();
  } catch (error) {
    console.error("Backfill failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
