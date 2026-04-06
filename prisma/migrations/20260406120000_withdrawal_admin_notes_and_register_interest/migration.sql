-- AlterEnum: Add REGISTER_INTEREST to SeasonStatus
-- Using IF NOT EXISTS because this enum value may already exist from db push on staging
ALTER TYPE "SeasonStatus" ADD VALUE IF NOT EXISTS 'REGISTER_INTEREST';

-- AlterTable: Add adminNotes and processedAt to WithdrawalRequest
ALTER TABLE "WithdrawalRequest" ADD COLUMN "adminNotes" TEXT;
ALTER TABLE "WithdrawalRequest" ADD COLUMN "processedAt" TIMESTAMP(3);
