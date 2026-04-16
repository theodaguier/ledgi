-- Migration: add_transaction_owner_user
-- Adds ownerUserId to Transaction to track which user imported each transaction.
-- Backfills from ImportBatch.createdByUserId, then BankAccount.ownerUserId.

BEGIN;

-- ── 1. Add ownerUserId column (nullable, FK added after backfill) ──────────
ALTER TABLE "Transaction"
    ADD COLUMN "ownerUserId" TEXT;

CREATE INDEX "Transaction_ownerUserId_idx" ON "Transaction"("ownerUserId");

-- ── 2. Backfill: from ImportBatch.createdByUserId ───────────────────────────
UPDATE "Transaction" AS tx
SET "ownerUserId" = ib."createdByUserId"
FROM "ImportBatch" AS ib
WHERE tx."importBatchId" = ib."id"
  AND tx."ownerUserId" IS NULL;

-- ── 3. Backfill: from BankAccount.ownerUserId for remaining ──────────────────
UPDATE "Transaction" AS tx
SET "ownerUserId" = ba."ownerUserId"
FROM "BankAccount" AS ba
WHERE tx."bankAccountId" = ba."id"
  AND tx."ownerUserId" IS NULL;

-- ── 4. Add FK constraint (NOT NULL would break; keep nullable for flexibility) ─
ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_ownerUserId_fkey"
        FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 5. Add userId index on ImportBatch for filter efficiency ─────────────────
CREATE INDEX "ImportBatch_createdByUserId_idx" ON "ImportBatch"("createdByUserId");

COMMIT;
