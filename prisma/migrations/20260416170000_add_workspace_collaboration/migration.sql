-- Migration: add_workspace_collaboration
-- Adds Workspace, WorkspaceMember, WorkspaceInvitation models
-- Migrates existing user data to personal workspaces
-- Replaces userId-scoped data ownership with workspaceId-scoped ownership

BEGIN;

-- ── 1. Create Workspace ────────────────────────────────────────────────────────
CREATE TABLE "Workspace" (
    "id"          TEXT        NOT NULL DEFAULT cuid(),
    "name"        TEXT        NOT NULL,
    "slug"        TEXT        NOT NULL UNIQUE,
    "type"        TEXT        NOT NULL DEFAULT 'PERSONAL',
    "defaultCurrency" TEXT    NOT NULL DEFAULT 'EUR',
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- ── 2. Create WorkspaceMember ──────────────────────────────────────────────────
CREATE TABLE "WorkspaceMember" (
    "id"          TEXT        NOT NULL DEFAULT cuid(),
    "workspaceId" TEXT        NOT NULL,
    "userId"      TEXT        NOT NULL,
    "role"        TEXT        NOT NULL DEFAULT 'MEMBER',
    "joinedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkspaceMember_workspaceId_userId_key" UNIQUE ("workspaceId", "userId")
);

CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

ALTER TABLE "WorkspaceMember"
    ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

ALTER TABLE "WorkspaceMember"
    ADD CONSTRAINT "WorkspaceMember_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- ── 3. Create WorkspaceInvitation ─────────────────────────────────────────────
CREATE TABLE "WorkspaceInvitation" (
    "id"          TEXT        NOT NULL DEFAULT cuid(),
    "workspaceId" TEXT        NOT NULL,
    "email"       TEXT        NOT NULL,
    "role"        TEXT        NOT NULL DEFAULT 'MEMBER',
    "status"      TEXT        NOT NULL DEFAULT 'PENDING',
    "token"       TEXT        NOT NULL UNIQUE,
    "expiresAt"   TIMESTAMPTZ NOT NULL,
    "inviterId"   TEXT        NOT NULL,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceInvitation_workspaceId_status_idx" ON "WorkspaceInvitation"("workspaceId", "status");
CREATE INDEX "WorkspaceInvitation_email_idx" ON "WorkspaceInvitation"("email");

ALTER TABLE "WorkspaceInvitation"
    ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

ALTER TABLE "WorkspaceInvitation"
    ADD CONSTRAINT "WorkspaceInvitation_inviterId_fkey"
        FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE;

-- ── 4. Add workspaceId columns (nullable first) ────────────────────────────────
ALTER TABLE "BankAccount"         ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ImportBatch"        ADD COLUMN "workspaceId"    TEXT;
ALTER TABLE "ImportBatch"        ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Transaction"        ADD COLUMN "workspaceId"     TEXT;
ALTER TABLE "Category"           ADD COLUMN "workspaceId"     TEXT;
ALTER TABLE "CategorizationRule" ADD COLUMN "workspaceId"     TEXT;
ALTER TABLE "ManualLabelCategory" ADD COLUMN "workspaceId"    TEXT;
ALTER TABLE "ApiKey"             ADD COLUMN "workspaceId"      TEXT;

-- ── 5. Create default workspaces for every existing user ──────────────────────
-- One personal workspace per user
INSERT INTO "Workspace" ("id", "name", "slug", "type", "defaultCurrency", "createdAt", "updatedAt")
SELECT
    'ws-personal-' || "id",
    COALESCE("name", split_part("email", '@', 1)) || '''s Space',
    'personal-' || "id",
    'PERSONAL',
    'EUR',
    now(),
    now()
FROM "User";

-- Add the creator as OWNER of their personal workspace
INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role", "joinedAt")
SELECT
    'wsm-' || "id",
    'ws-personal-' || "id",
    "id",
    'OWNER',
    now()
FROM "User";

-- ── 6. Populate workspaceId on existing data ───────────────────────────────────
UPDATE "BankAccount"
    SET "workspaceId" = 'ws-personal-' || "userId";

UPDATE "ImportBatch"
    SET
        "workspaceId"     = 'ws-personal-' || "userId",
        "createdByUserId" = "userId";

UPDATE "Transaction"
    SET "workspaceId" = 'ws-personal-' || (
        SELECT "userId" FROM "BankAccount" WHERE "BankAccount"."id" = "Transaction"."bankAccountId"
    );

UPDATE "Category"
    SET "workspaceId" = 'ws-personal-' || "userId" WHERE "userId" IS NOT NULL;

UPDATE "CategorizationRule"
    SET "workspaceId" = 'ws-personal-' || "userId";

UPDATE "ManualLabelCategory"
    SET "workspaceId" = 'ws-personal-' || "userId";

UPDATE "ApiKey"
    SET "workspaceId" = 'ws-personal-' || "userId";

-- ── 7. Make workspaceId NOT NULL with FK constraint ───────────────────────────
ALTER TABLE "BankAccount"
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ADD CONSTRAINT "BankAccount_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

ALTER TABLE "ImportBatch"
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ALTER COLUMN "createdByUserId" SET NOT NULL,
    ADD CONSTRAINT "ImportBatch_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

ALTER TABLE "Transaction"
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ADD CONSTRAINT "Transaction_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

ALTER TABLE "Category"
    ADD CONSTRAINT "Category_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

ALTER TABLE "CategorizationRule"
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ADD CONSTRAINT "CategorizationRule_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

ALTER TABLE "ManualLabelCategory"
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ADD CONSTRAINT "ManualLabelCategory_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

ALTER TABLE "ApiKey"
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ADD CONSTRAINT "ApiKey_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

-- ── 8. Drop old userId columns + unique constraints ───────────────────────────
ALTER TABLE "BankAccount"         DROP COLUMN "userId";
ALTER TABLE "ImportBatch"        DROP COLUMN "userId";

ALTER TABLE "Category"
    DROP CONSTRAINT "Category_userId_slug_key" CASCADE,
    DROP COLUMN "userId";

ALTER TABLE "CategorizationRule"  DROP COLUMN "userId";
ALTER TABLE "ManualLabelCategory" DROP COLUMN "userId";
ALTER TABLE "ApiKey"             DROP COLUMN "userId";

-- ── 9. Fix Transaction hash: was globally @unique, now @@index (per workspace) ─
DROP INDEX "Transaction_hash_key";
CREATE INDEX "Transaction_workspaceId_hash_idx" ON "Transaction"("workspaceId", "hash");

-- ── 10. Update @@unique constraints for workspaceId scoping ───────────────────
-- Category: @@unique([workspaceId, slug]) - already covered by new schema
-- CategorizationRule: no unique constraint needed
-- ManualLabelCategory: @@unique([workspaceId, labelNormalized, type]) - already covered

-- Add composite unique for ManualLabelCategory (workspaceId + labelNormalized + type)
-- already covered by new schema

COMMIT;
