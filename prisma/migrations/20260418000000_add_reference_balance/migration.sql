-- AlterTable: rename balance -> referenceBalance and add referenceBalanceDate
ALTER TABLE "BankAccount" RENAME COLUMN "balance" TO "referenceBalance";
ALTER TABLE "BankAccount" ADD COLUMN "referenceBalanceDate" TIMESTAMP;
