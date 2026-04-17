import { NextRequest } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyApiKey, requireScope } from "@/lib/api-auth";
import {
  generateTransactionHash,
  findColumn,
  parseCSV,
  detectSeparator,
  detectFormat,
  parseAmount,
  parseDate,
  type FormatProfile,
} from "@/lib/csv-parser";
import { categorizeTransaction, normalizeLabel, extractMerchant, buildManualDecisionKey, type ManualDecisionMap } from "@/lib/categorization";
import { Prisma, TransactionType } from "@prisma/client";

export async function POST(request: NextRequest) {
  const authCtx = await verifyApiKey(request.headers.get("Authorization"));
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireScope(authCtx, "imports.create");
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
    typeof body.fileContent !== "string" ||
    !body.fileName ||
    !body.bankAccountId
  ) {
    return Response.json(
      { error: "Invalid body: fileContent, fileName, and bankAccountId required" },
      { status: 400 }
    );
  }

  const account = await prisma.bankAccount.findFirst({
    where: { id: body.bankAccountId, workspaceId },
  });

  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  const separator = detectSeparator(body.fileContent);
  const { headers: csvHeaders, rows } = parseCSV(body.fileContent, separator);

  if (rows.length === 0) {
    return Response.json({ error: "Empty CSV file" }, { status: 400 });
  }

  const format = detectFormat(csvHeaders);

  const dateCol = findColumn(csvHeaders, [
    "date", "date operation", "date de l'operation", "dateope",
    "transaction date", "dateop", "dateval", "date de valeur",
    "date comptabilisation", "datevaleur",
  ]);
  const labelCol = findColumn(csvHeaders, [
    "libelle", "libellé", "description", "nature",
    "reference", "merchant", "label", "libelle operation", "libelle complet",
  ]);
  const amountCol = findColumn(csvHeaders, ["montant", "amount", "somme", "accountbalance"]);
  const creditCol = findColumn(csvHeaders, ["credit", "crédit", "montant credit", "supplierFound"]);
  const debitCol = findColumn(csvHeaders, ["debit", "débit", "montant debit", "category"]);

  if (!dateCol || !labelCol || (!amountCol && !creditCol && !debitCol)) {
    return Response.json(
      { error: `Missing required columns. Found: ${csvHeaders.join(", ")}` },
      { status: 400 }
    );
  }

  const rules = await prisma.categorizationRule.findMany({
    where: { workspaceId, isActive: true },
    orderBy: { priority: "asc" },
  });

  const manualDecisions = await prisma.manualLabelCategory.findMany({
    where: { workspaceId },
    select: { labelNormalized: true, type: true, categoryId: true },
  });
  const manualDecisionMap: ManualDecisionMap = new Map(
    manualDecisions.map((d: { labelNormalized: string; type: TransactionType; categoryId: string }) =>
      [buildManualDecisionKey(d.labelNormalized, d.type), d.categoryId]
    )
  );

  const batch = await prisma.importBatch.create({
    data: {
      workspaceId,
      createdByUserId: authCtx.userId,
      bankAccountId: body.bankAccountId,
      fileName: body.fileName,
      originalName: body.fileName,
      formatDetected: format?.name ?? "unknown",
      status: "PROCESSING",
      totalRows: rows.length,
    },
  });

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

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

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowData: Record<string, string> = {};
    csvHeaders.forEach((h, idx) => {
      rowData[h] = row[idx] ?? "";
    });

    try {
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
        amount = parseAmount(row[csvHeaders.indexOf(amountCol)], format ?? defaultProfile);
        type = amount < 0 ? "DEBIT" : "CREDIT";
        amount = Math.abs(amount);
      } else {
        if (creditCol) {
          const credit = parseAmount(row[csvHeaders.indexOf(creditCol)], format ?? defaultProfile);
          if (credit > 0) {
            amount = credit;
            type = "CREDIT";
          }
        }
        if (debitCol && amount === 0) {
          const debit = parseAmount(row[csvHeaders.indexOf(debitCol)], format ?? defaultProfile);
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

      const existing = await prisma.transaction.findUnique({ where: { workspaceId_hash: { workspaceId, hash } } });
      if (existing) {
        skipped++;
        continue;
      }

      const merchant = extractMerchant(label);
      const categorization = await categorizeTransaction(label, amount, rules, undefined, manualDecisionMap, merchant);

      await prisma.transaction.create({
        data: {
          workspaceId,
          importBatchId: batch.id,
          ownerUserId: authCtx.userId,
          bankAccountId: body.bankAccountId,
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
          hash,
          metadata: {
            matchedRule: categorization.matchedRule,
            originalRow: rowData,
          } as Prisma.InputJsonObject,
        },
      });

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

  return Response.json({
    batchId: batch.id,
    success: true,
    imported,
    skipped,
    errors: errors.slice(0, 20),
  }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const authCtx = await verifyApiKey(request.headers.get("Authorization"));
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireScope(authCtx, "imports.delete");
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
  const batchId = searchParams.get("id");

  if (!batchId) {
    return Response.json({ error: "Query param id required" }, { status: 400 });
  }

  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, workspaceId },
  });

  if (!batch) {
    return Response.json({ error: "Import batch not found" }, { status: 404 });
  }

  await prisma.transaction.deleteMany({
    where: { importBatchId: batchId },
  });

  await prisma.importBatch.delete({
    where: { id: batchId },
  });

  return Response.json({ success: true });
}
