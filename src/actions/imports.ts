"use server";

import { prisma } from "@/lib/auth";
import { generateTransactionHash, findColumn } from "@/lib/csv-parser";
import { parseCSV, detectSeparator, detectFormat, parseAmount, parseDate, type FormatProfile } from "@/lib/csv-parser";
import { categorizeTransaction, normalizeLabel, extractMerchant, buildManualDecisionKey, buildGroupKey, type ManualDecisionMap } from "@/lib/categorization";
import { Prisma, TransactionType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/workspace";
import { importFormSchema } from "@/lib/validation/schemas";

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
  const parsed = importFormSchema.safeParse({ accountId: bankAccountId });
  if (!parsed.success) {
    return { success: false, imported: 0, skipped: 0, errors: parsed.error.issues.map((i) => i.message), batchId: "" };
  }

  const ctx = await getWorkspaceContext();

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
    where: { workspaceId: ctx.workspaceId, isActive: true },
    orderBy: { priority: "asc" },
  });

  const manualDecisions = await prisma.manualLabelCategory.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: { labelNormalized: true, type: true, categoryId: true },
  });
  const manualDecisionMap: ManualDecisionMap = new Map(
    manualDecisions.map((d: { labelNormalized: string; type: TransactionType; categoryId: string }) =>
      [buildManualDecisionKey(d.labelNormalized, d.type), d.categoryId]
    )
  );

  const batch = await prisma.importBatch.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdByUserId: ctx.userId,
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
        amount = parseAmount(
          row[csvHeaders.indexOf(amountCol)],
          format ?? defaultProfile,
        );
        type = amount < 0 ? "DEBIT" : "CREDIT";
        amount = Math.abs(amount);
      } else {
        if (creditCol) {
          const credit = parseAmount(
            row[csvHeaders.indexOf(creditCol)],
            format ?? defaultProfile,
          );
          if (credit > 0) {
            amount = credit;
            type = "CREDIT";
          }
        }
        if (debitCol && amount === 0) {
          const debit = parseAmount(
            row[csvHeaders.indexOf(debitCol)],
            format ?? defaultProfile,
          );
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
        where: { workspaceId_hash: { workspaceId: ctx.workspaceId, hash } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const merchant = extractMerchant(label);
      const categorization = await categorizeTransaction(label, amount, rules, undefined, manualDecisionMap, merchant);
      const groupKey = buildGroupKey(label, amount, type, "EUR");

      const tx = await prisma.transaction.create({
        data: {
          workspaceId: ctx.workspaceId,
          importBatchId: batch.id,
          ownerUserId: ctx.userId,
          bankAccountId,
          dateOperation: dateValue,
          label,
          labelNormalized: normalizeLabel(label),
          merchant,
          amount,
          currency: "EUR",
          type,
          isAutomatic: type === "DEBIT",
          categoryId: categorization.categoryId,
          confidence: categorization.confidence,
          groupKey,
          hash,
          metadata: {
            matchedRule: categorization.matchedRule,
            originalRow: rowData,
          } as Prisma.InputJsonObject,
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
      errorLog: errors.slice(0, 100),
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

export async function deleteImportBatch(batchId: string) {
  const ctx = await getWorkspaceContext();

  await prisma.transaction.deleteMany({
    where: { importBatchId: batchId, bankAccount: { workspaceId: ctx.workspaceId } },
  });

  await prisma.importBatch.delete({
    where: { id: batchId, workspaceId: ctx.workspaceId },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/imports");

  return { success: true };
}
