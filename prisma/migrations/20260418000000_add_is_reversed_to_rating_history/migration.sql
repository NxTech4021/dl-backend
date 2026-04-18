-- Audit-B1: idempotency flag for rating reversal.
-- Previously reverseMatchRatings appended " [REVERSED]" to notes as a
-- human-readable marker but never read it back as a guard, so a second
-- call on the same matchId re-decremented matchesPlayed. This column
-- lets the reversal path filter out already-reversed rows cleanly.

-- AlterTable
ALTER TABLE "public"."rating_history" ADD COLUMN "isReversed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "rating_history_matchId_isReversed_idx" ON "public"."rating_history"("matchId", "isReversed");

-- Backfill: any pre-existing row whose notes contain the "[REVERSED]"
-- marker (appended by the legacy reversal path) is flagged so future
-- reversal calls on the same matchId do NOT re-decrement matchesPlayed.
UPDATE "public"."rating_history"
SET "isReversed" = true
WHERE "notes" LIKE '%[REVERSED]%';
