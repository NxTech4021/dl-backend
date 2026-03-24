-- Add WALKOVER_PENDING status to MatchStatus enum
ALTER TYPE "MatchStatus" ADD VALUE 'WALKOVER_PENDING';

-- Add dispute fields to MatchWalkover
ALTER TABLE "match_walkover" ADD COLUMN "isDisputed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "match_walkover" ADD COLUMN "disputedAt" TIMESTAMP(3);
ALTER TABLE "match_walkover" ADD COLUMN "disputeReason" TEXT;
ALTER TABLE "match_walkover" ADD COLUMN "disputeExpiresAt" TIMESTAMP(3);
