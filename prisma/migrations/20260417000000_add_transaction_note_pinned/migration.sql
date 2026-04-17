-- Migration: add_transaction_note_pinned
-- Adds note (free-text annotation) and pinned (boolean flag) to Transaction.

BEGIN;

ALTER TABLE "Transaction"
    ADD COLUMN "note" TEXT;

ALTER TABLE "Transaction"
    ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Transaction_pinned_idx" ON "Transaction"("pinned");

COMMIT;
