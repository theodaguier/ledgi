-- Migration: add_group_key_brand_domain_and_missing_indexes
--
-- This migration aligns the database schema with prisma/schema.prisma:
-- 1. Add Transaction.groupKey column (nullable)
-- 2. Add ManualLabelCategory.groupKey column (nullable)
-- 3. Add BankAccount.bankBrandDomain column (nullable)
-- 4. Create missing composite indexes on Transaction
-- 5. Ensure Transaction(workspaceId, hash) unique constraint exists
-- 6. Ensure ManualLabelCategory table and its constraints exist
-- 7. Create ManualLabelCategory unique constraints and indexes
--
-- The migration is idempotent and safe to run on databases created
-- via db push or via the committed migration history.

-- ============================================================================
-- Transaction table
-- ============================================================================

-- 1. Add groupKey column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Transaction'
          AND column_name = 'groupKey'
    ) THEN
        ALTER TABLE "Transaction" ADD COLUMN "groupKey" TEXT;
        RAISE NOTICE 'Added Transaction.groupKey column';
    ELSE
        RAISE NOTICE 'Transaction.groupKey column already exists';
    END IF;
END $$;

-- 2. Create index on (workspaceId, merchant, type, dateOperation)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'Transaction'
          AND indexname = 'Transaction_workspaceId_merchant_type_dateOperation_idx'
    ) THEN
        CREATE INDEX "Transaction_workspaceId_merchant_type_dateOperation_idx"
            ON "Transaction"("workspaceId", "merchant", "type", "dateOperation");
        RAISE NOTICE 'Created Transaction(merchant) index';
    END IF;
END $$;

-- 3. Create index on (workspaceId, labelNormalized, type, dateOperation)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'Transaction'
          AND indexname = 'Transaction_workspaceId_labelNormalized_type_dateOperation_idx'
    ) THEN
        CREATE INDEX "Transaction_workspaceId_labelNormalized_type_dateOperation_idx"
            ON "Transaction"("workspaceId", "labelNormalized", "type", "dateOperation");
        RAISE NOTICE 'Created Transaction(labelNormalized) index';
    END IF;
END $$;

-- 4. Create index on (workspaceId, groupKey, type, dateOperation)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'Transaction'
          AND indexname = 'Transaction_workspaceId_groupKey_type_dateOperation_idx'
    ) THEN
        CREATE INDEX "Transaction_workspaceId_groupKey_type_dateOperation_idx"
            ON "Transaction"("workspaceId", "groupKey", "type", "dateOperation");
        RAISE NOTICE 'Created Transaction(groupKey) index';
    END IF;
END $$;

-- 5. Ensure unique constraint on (workspaceId, hash)
DO $$
BEGIN
    -- Drop non-unique index if it exists (from previous migration)
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'Transaction'
          AND indexname = 'Transaction_workspaceId_hash_idx'
    ) THEN
        DROP INDEX "Transaction_workspaceId_hash_idx";
        RAISE NOTICE 'Dropped non-unique Transaction_workspaceId_hash_idx';
    END IF;

    -- Create unique constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Transaction_workspaceId_hash_key'
    ) THEN
        ALTER TABLE "Transaction"
            ADD CONSTRAINT "Transaction_workspaceId_hash_key"
            UNIQUE ("workspaceId", "hash");
        RAISE NOTICE 'Created Transaction(workspaceId, hash) unique constraint';
    END IF;
END $$;

-- ============================================================================
-- ManualLabelCategory table
-- ============================================================================

-- 6. Create ManualLabelCategory table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'ManualLabelCategory'
    ) THEN
        CREATE TABLE "ManualLabelCategory" (
            "id" TEXT NOT NULL,
            "workspaceId" TEXT NOT NULL,
            "labelNormalized" TEXT NOT NULL,
            "type" "TransactionType" NOT NULL,
            "categoryId" TEXT NOT NULL,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            "groupKey" TEXT
        );

        ALTER TABLE "ManualLabelCategory"
            ADD CONSTRAINT "ManualLabelCategory_pkey" PRIMARY KEY ("id");

        ALTER TABLE "ManualLabelCategory"
            ADD CONSTRAINT "ManualLabelCategory_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

        RAISE NOTICE 'Created ManualLabelCategory table';
    END IF;
END $$;

-- 7. Add groupKey column to ManualLabelCategory if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ManualLabelCategory'
          AND column_name = 'groupKey'
    ) THEN
        ALTER TABLE "ManualLabelCategory" ADD COLUMN "groupKey" TEXT;
        RAISE NOTICE 'Added ManualLabelCategory.groupKey column';
    END IF;
END $$;

-- 8. Create unique constraint on (workspaceId, labelNormalized, type)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ManualLabelCategory_workspaceId_labelNormalized_type_key'
    ) THEN
        ALTER TABLE "ManualLabelCategory"
            ADD CONSTRAINT "ManualLabelCategory_workspaceId_labelNormalized_type_key"
            UNIQUE ("workspaceId", "labelNormalized", "type");
        RAISE NOTICE 'Created ManualLabelCategory(labelNormalized) unique constraint';
    END IF;
END $$;

-- 9. Create unique constraint on (workspaceId, groupKey, type)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ManualLabelCategory_workspaceId_groupKey_type_key'
    ) THEN
        ALTER TABLE "ManualLabelCategory"
            ADD CONSTRAINT "ManualLabelCategory_workspaceId_groupKey_type_key"
            UNIQUE ("workspaceId", "groupKey", "type");
        RAISE NOTICE 'Created ManualLabelCategory(groupKey) unique constraint';
    END IF;
END $$;

-- 10. Create index on (workspaceId, type)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'ManualLabelCategory'
          AND indexname = 'ManualLabelCategory_workspaceId_type_idx'
    ) THEN
        CREATE INDEX "ManualLabelCategory_workspaceId_type_idx"
            ON "ManualLabelCategory"("workspaceId", "type");
        RAISE NOTICE 'Created ManualLabelCategory(type) index';
    END IF;
END $$;

-- ============================================================================
-- BankAccount table
-- ============================================================================

-- 11. Add bankBrandDomain column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'BankAccount'
          AND column_name = 'bankBrandDomain'
    ) THEN
        ALTER TABLE "BankAccount" ADD COLUMN "bankBrandDomain" TEXT;
        RAISE NOTICE 'Added BankAccount.bankBrandDomain column';
    ELSE
        RAISE NOTICE 'BankAccount.bankBrandDomain column already exists';
    END IF;
END $$;
