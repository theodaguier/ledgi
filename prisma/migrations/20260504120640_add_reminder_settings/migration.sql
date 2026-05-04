-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "lastRemindedAt" TIMESTAMP(3),
ADD COLUMN     "reminderHour" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "reminderIntervalDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT false;
