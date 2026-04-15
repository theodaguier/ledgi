"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/auth";
import { generateTransactionHash } from "@/lib/csv-parser";
import { parseCSV, detectSeparator, detectFormat, parseAmount, parseDate, type FormatProfile } from "@/lib/csv-parser";
import { categorizeTransaction, normalizeLabel, extractMerchant } from "@/lib/categorization";
import { ImportStatus, MatchType, TransactionType } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  batchId: string;
}

export async function importCSV(
  fileContent: string,
  fileName: string,
  bankAccountId: string
): Promise<ImportResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, imported: 0, skipped: 0, errors: ["Not authenticated"], batchId: "" };
  }

  const userId = session.user.id;
  const separator = detectSeparator(fileContent);
  const { headers: csvHeaders, rows } = parseCSV(fileContent, separator);

  if (rows.length === 0) {
    return { success: false, imported: 0, skipped: 0, errors: ["Empty CSV file"], batchId: "" };
  }

  const format = detectFormat(csvHeaders);

  const dateCol = findColumn(csvHeaders, [
    "date",
    "date operation",
    "date de l'operation",
    "dateope",
    "transaction date",
    "dateop",
    "dateval",
    "date de valeur",
    "date comptabilisation",
    "datevaleur",
  ]);
  const labelCol = findColumn(csvHeaders, [
    "libelle",
    "libellé",
    "description",
    "nature",
    "reference",
    "merchant",
    "label",
    "libelle operation",
    "libelle complet",
  ]);
  const amountCol = findColumn(csvHeaders, [
    "montant",
    "amount",
    "somme",
    "accountbalance",
  ]);
  const creditCol = findColumn(csvHeaders, [
    "credit",
    "crédit",
    "montant credit",
    "supplierFound",
  ]);
  const debitCol = findColumn(csvHeaders, [
    "debit",
    "débit",
    "montant debit",
    "category",
  ]);

  if (!dateCol || !labelCol || (!amountCol && !creditCol && !debitCol)) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [`Missing required columns. Found: ${csvHeaders.join(", ")}`],
      batchId: "",
    };
  }

  const rules = await prisma.categorizationRule.findMany({
    where: { userId, isActive: true },
    orderBy: { priority: "asc" },
  });

  const batch = await prisma.importBatch.create({
    data: {
      userId,
      bankAccountId,
      fileName,
      originalName: fileName,
      formatDetected: format?.name ?? "unknown",
      status: "PROCESSING",
      totalRows: rows.length,
    },
  });

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowData: Record<string, string> = {};
    csvHeaders.forEach((h, idx) => {
      rowData[h] = row[idx] ?? "";
    });

    try {
      const defaultProfile: FormatProfile = {
        name: "unknown",
        dateFormat: "dd/MM/yyyy",
        dateColumns: [],
        labelColumns: [],
        amountColumns: [],
        creditColumns: [],
        debitColumns: [],
        decimalSeparator: ",",
        thousandsSeparator: " ",
        headerMappings: {},
      };
      const dateValue = parseDate(row[csvHeaders.indexOf(dateCol)], format ?? defaultProfile);
      if (!dateValue) {
        errors.push(`Row ${i + 2}: Invalid date`);
        continue;
      }

      const label = row[csvHeaders.indexOf(labelCol)]?.trim() ?? "";
      if (!label) {
        errors.push(`Row ${i + 2}: Empty label`);
        continue;
      }

      let amount = 0;
      let type: TransactionType = "DEBIT";

      if (amountCol) {
        amount = parseAmount(row[csvHeaders.indexOf(amountCol)], format ?? { decimalSeparator: ",", thousandsSeparator: " " } as any);
        type = amount < 0 ? "CREDIT" : "DEBIT";
        amount = Math.abs(amount);
      } else {
        if (creditCol) {
          const credit = parseAmount(row[csvHeaders.indexOf(creditCol)], format ?? { decimalSeparator: ",", thousandsSeparator: " " } as any);
          if (credit > 0) {
            amount = credit;
            type = "CREDIT";
          }
        }
        if (debitCol && amount === 0) {
          const debit = parseAmount(row[csvHeaders.indexOf(debitCol)], format ?? { decimalSeparator: ",", thousandsSeparator: " " } as any);
          if (debit > 0) {
            amount = debit;
            type = "DEBIT";
          }
        }
      }

      if (amount === 0) {
        skipped++;
        continue;
      }

      const hash = generateTransactionHash(dateValue, amount, label);

      const existing = await prisma.transaction.findUnique({
        where: { hash },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const categorization = await categorizeTransaction(label, amount, rules);

      const tx = await prisma.transaction.create({
        data: {
          importBatchId: batch.id,
          bankAccountId,
          dateOperation: dateValue,
          label,
          labelNormalized: normalizeLabel(label),
          merchant: extractMerchant(label),
          amount,
          currency: "EUR",
          type,
          isAutomatic: type === "DEBIT",
          categoryId: categorization.categoryId,
          confidence: categorization.confidence,
          hash,
          metadata: {
            matchedRule: categorization.matchedRule,
            originalRow: rowData,
          } as any,
        },
      });

      if (!tx) {
        errors.push(`Row ${i + 2}: Failed to insert`);
        continue;
      }

      imported++;
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: errors.length > 0 && imported === 0 ? "FAILED" : "COMPLETED",
      importedCount: imported,
      skippedCount: skipped,
      errorCount: errors.length,
      errorLog: errors.slice(0, 100) as any,
    },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/imports");

  return {
    success: true,
    imported,
    skipped,
    errors: errors.slice(0, 20),
    batchId: batch.id,
  };
}

function findColumn(headers: string[], candidates: string[]): string | null {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  return null;
}

export async function deleteImportBatch(batchId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { error: "Not authenticated" };

  await prisma.transaction.deleteMany({
    where: { importBatchId: batchId, bankAccount: { userId: session.user.id } },
  });

  await prisma.importBatch.delete({
    where: { id: batchId, userId: session.user.id },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/imports");

  return { success: true };
}
