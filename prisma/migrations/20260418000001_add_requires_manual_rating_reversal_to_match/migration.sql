-- Audit-B2 Option C: split-brain visibility flag.
-- Set to true when reverseMatchRatings or recalculateDivisionStandings
-- fails AFTER the outer voidMatch / resolveDispute transaction has
-- already committed. Because both callees open their own $transaction
-- on a separate Prisma pool connection (inner cannot join outer), the
-- inner failure does not roll back the outer VOID status flip.
--
-- No backfill needed — no in-production Match row today reflects a
-- partial-reversal state (the bug surfaces only on future failures).

-- AlterTable
ALTER TABLE "public"."Match" ADD COLUMN "requiresManualRatingReversal" BOOLEAN NOT NULL DEFAULT false;
