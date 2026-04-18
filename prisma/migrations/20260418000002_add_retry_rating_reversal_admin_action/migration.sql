-- Audit-B2 retry endpoint: new MatchAdminActionType value for the
-- RETRY_RATING_REVERSAL admin action. Used when an admin re-invokes
-- reverseMatchRatings + standings recalc on a VOID match that was
-- flagged requiresManualRatingReversal=true due to a post-tx failure.
-- ALTER TYPE ADD VALUE is non-destructive; existing enum rows unaffected.

-- AlterEnum
ALTER TYPE "public"."MatchAdminActionType" ADD VALUE 'RETRY_RATING_REVERSAL';
