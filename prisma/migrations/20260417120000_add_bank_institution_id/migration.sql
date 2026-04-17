-- Migration: add_bank_institution_id
-- Adds bankInstitutionId column to BankAccount.
-- This column was introduced in the Prisma schema but never captured
-- in a migration (relied on db push instead). Also ensures ownerUserId
-- and type are present idempotently in case a future reset uses only
-- committed migrations.

BEGIN;

ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "bankInstitutionId" TEXT;

-- Guard: ensure AccountType enum exists (may already be present from db push)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountType') THEN
        CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'OTHER');
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'AccountType enum may already exist: %', SQLERRM;
END $$;

-- Guard: add type column if missing (not in any committed migration)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'BankAccount'
          AND column_name = 'type'
    ) THEN
        ALTER TABLE "BankAccount" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'CHECKING';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'type column may already exist: %', SQLERRM;
END $$;

-- Guard: add ownerUserId column if missing (referenced in transaction_owner_user migration but never added to BankAccount)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'BankAccount'
          AND column_name = 'ownerUserId'
    ) THEN
        ALTER TABLE "BankAccount" ADD COLUMN "ownerUserId" TEXT;
        ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_ownerUserId_fkey"
            FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ownerUserId column may already exist: %', SQLERRM;
END $$;

COMMIT;
