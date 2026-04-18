-- Audit-B2 retry endpoint follow-up: mirror the match-scoped
-- MatchAdminActionType.RETRY_RATING_REVERSAL (added in 20260418000002)
-- in the outer AdminActionType enum used by logMatchAction / AdminLog.
--
-- Previously the controller fell back to AdminActionType.OTHER with a
-- descriptive message — audit searches had to filter by message text
-- substring. With a dedicated enum value, "WHERE actionType='MATCH_RETRY_RATING_REVERSAL'"
-- is clean, indexable, and consistent with MATCH_VOID / MATCH_EDIT_RESULT /
-- MATCH_WALKOVER naming.
--
-- ALTER TYPE ADD VALUE is non-destructive; pre-existing AdminLog rows
-- using OTHER or other match actions are unaffected.

-- AlterEnum
ALTER TYPE "public"."AdminActionType" ADD VALUE 'MATCH_RETRY_RATING_REVERSAL';
