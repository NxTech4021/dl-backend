-- CreateEnum
CREATE TYPE "public"."UserActionType" AS ENUM ('MATCH_CREATE', 'MATCH_JOIN', 'MATCH_CANCEL', 'MATCH_LEAVE', 'SCORE_SUBMIT', 'SCORE_CONFIRM', 'SCORE_DISPUTE', 'WALKOVER_REPORT', 'WALKOVER_CONFIRM', 'PAIR_REQUEST_SEND', 'PAIR_REQUEST_ACCEPT', 'PAIR_REQUEST_DENY', 'PARTNERSHIP_DISSOLVE', 'SEASON_REGISTER', 'SEASON_WITHDRAW', 'INVITATION_RESPOND_ACCEPT', 'INVITATION_RESPOND_DECLINE', 'PAYMENT_COMPLETE', 'PAYMENT_FAIL');

-- CreateEnum
CREATE TYPE "public"."UserTargetType" AS ENUM ('MATCH', 'SEASON', 'PARTNERSHIP', 'INVITATION', 'PAYMENT');

-- CreateEnum
CREATE TYPE "public"."AchievementCategory" AS ENUM ('MATCH_COUNTER', 'LEAGUE_SEASON', 'WINNING', 'MULTI_SPORT', 'MATCH_STREAK');

-- CreateEnum
CREATE TYPE "public"."AchievementScope" AS ENUM ('MATCH', 'SEASON', 'LIFETIME');

-- CreateEnum
CREATE TYPE "public"."SkillLevel" AS ENUM ('BEGINNER', 'IMPROVER', 'INTERMEDIATE', 'UPPER_INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- AlterEnum
ALTER TYPE "public"."GenderType" ADD VALUE 'OPEN';

-- AlterEnum
ALTER TYPE "public"."AdminActionType" ADD VALUE 'ADMIN_SUSPEND';
ALTER TYPE "public"."AdminActionType" ADD VALUE 'ADMIN_ACTIVATE';
ALTER TYPE "public"."AdminActionType" ADD VALUE 'PAYMENT_STATUS_UPDATE';
ALTER TYPE "public"."AdminActionType" ADD VALUE 'PAYMENT_BULK_UPDATE';

-- AlterEnum
ALTER TYPE "public"."AdminTargetType" ADD VALUE 'PAYMENT';

-- AlterEnum
ALTER TYPE "public"."StatusChangeReason" ADD VALUE 'ADMIN_SUSPEND';
ALTER TYPE "public"."StatusChangeReason" ADD VALUE 'ADMIN_ACTIVATE';

-- AlterEnum
ALTER TYPE "public"."TierType" ADD VALUE 'NONE';

-- DropIndex
DROP INDEX IF EXISTS "public"."UserAchievement_userId_idx";

-- DropIndex
DROP INDEX IF EXISTS "public"."verification_value_key";

-- AlterTable
ALTER TABLE "public"."Achievement" DROP COLUMN IF EXISTS "requirement",
ADD COLUMN     "badgeGroup" TEXT,
ADD COLUMN     "evaluatorKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gameTypeFilter" "public"."GameType",
ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRevocable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scope" "public"."AchievementScope" NOT NULL DEFAULT 'LIFETIME',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sportFilter" "public"."SportType",
ADD COLUMN     "threshold" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "tier" "public"."TierType" NOT NULL DEFAULT 'BRONZE';

-- Drop old category column and add new one
ALTER TABLE "public"."Achievement" DROP COLUMN "category";
ALTER TABLE "public"."Achievement" ADD COLUMN "category" "public"."AchievementCategory" NOT NULL DEFAULT 'WINNING';

-- AlterTable - Fix icon to NOT NULL if needed
ALTER TABLE "public"."Achievement" ALTER COLUMN "icon" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."UserAchievement" ALTER COLUMN "unlockedAt" DROP NOT NULL,
ALTER COLUMN "unlockedAt" DROP DEFAULT;

-- Change progress from Float to Int
ALTER TABLE "public"."UserAchievement" DROP COLUMN IF EXISTS "progress";
ALTER TABLE "public"."UserAchievement" ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "public"."UserAchievement" ALTER COLUMN "isCompleted" SET DEFAULT false;

-- AlterTable
ALTER TABLE "public"."user_settings" ADD COLUMN IF NOT EXISTS "padelSkillLevel" "public"."SkillLevel",
ADD COLUMN IF NOT EXISTS "pickleballSkillLevel" "public"."SkillLevel",
ADD COLUMN IF NOT EXISTS "tennisSkillLevel" "public"."SkillLevel";

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."user_activity_log" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" "public"."UserActionType" NOT NULL,
    "targetType" "public"."UserTargetType" NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."admin_status_change" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "previousStatus" "public"."AdminStatus" NOT NULL,
    "newStatus" "public"."AdminStatus" NOT NULL,
    "reason" "public"."StatusChangeReason" NOT NULL,
    "notes" TEXT,
    "triggeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_status_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."FeedPost" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "caption" VARCHAR(500),
    "sport" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "winnerIds" TEXT[],
    "loserIds" TEXT[],
    "matchDate" TIMESTAMP(3) NOT NULL,
    "leagueId" TEXT,
    "divisionId" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."FeedLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."FeedComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" VARCHAR(200) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_activity_log_userId_createdAt_idx" ON "public"."user_activity_log"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "user_activity_log_targetId_createdAt_idx" ON "public"."user_activity_log"("targetId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "user_activity_log_actionType_createdAt_idx" ON "public"."user_activity_log"("actionType", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "user_activity_log_createdAt_idx" ON "public"."user_activity_log"("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "admin_status_change_adminId_createdAt_idx" ON "public"."admin_status_change"("adminId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "admin_status_change_newStatus_idx" ON "public"."admin_status_change"("newStatus");
CREATE INDEX IF NOT EXISTS "admin_status_change_reason_idx" ON "public"."admin_status_change"("reason");

CREATE INDEX IF NOT EXISTS "FeedPost_authorId_idx" ON "public"."FeedPost"("authorId");
CREATE INDEX IF NOT EXISTS "FeedPost_matchId_idx" ON "public"."FeedPost"("matchId");
CREATE INDEX IF NOT EXISTS "FeedPost_sport_idx" ON "public"."FeedPost"("sport");
CREATE INDEX IF NOT EXISTS "FeedPost_createdAt_idx" ON "public"."FeedPost"("createdAt");
CREATE INDEX IF NOT EXISTS "FeedPost_isDeleted_createdAt_idx" ON "public"."FeedPost"("isDeleted", "createdAt");

CREATE INDEX IF NOT EXISTS "FeedLike_postId_idx" ON "public"."FeedLike"("postId");
CREATE INDEX IF NOT EXISTS "FeedLike_userId_idx" ON "public"."FeedLike"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "FeedLike_postId_userId_key" ON "public"."FeedLike"("postId", "userId");

CREATE INDEX IF NOT EXISTS "FeedComment_postId_idx" ON "public"."FeedComment"("postId");
CREATE INDEX IF NOT EXISTS "FeedComment_authorId_idx" ON "public"."FeedComment"("authorId");
CREATE INDEX IF NOT EXISTS "FeedComment_postId_isDeleted_createdAt_idx" ON "public"."FeedComment"("postId", "isDeleted", "createdAt");

CREATE INDEX IF NOT EXISTS "Achievement_category_idx" ON "public"."Achievement"("category");
CREATE INDEX IF NOT EXISTS "Achievement_scope_idx" ON "public"."Achievement"("scope");
CREATE UNIQUE INDEX IF NOT EXISTS "Achievement_evaluatorKey_sportFilter_gameTypeFilter_thresho_key" ON "public"."Achievement"("evaluatorKey", "sportFilter", "gameTypeFilter", "threshold");

CREATE INDEX IF NOT EXISTS "Match_divisionId_seasonId_status_idx" ON "public"."Match"("divisionId", "seasonId", "status");
CREATE INDEX IF NOT EXISTS "SeasonMembership_userId_seasonId_idx" ON "public"."SeasonMembership"("userId", "seasonId");
CREATE INDEX IF NOT EXISTS "SeasonMembership_seasonId_status_idx" ON "public"."SeasonMembership"("seasonId", "status");
CREATE INDEX IF NOT EXISTS "UserAchievement_userId_isCompleted_idx" ON "public"."UserAchievement"("userId", "isCompleted");
CREATE INDEX IF NOT EXISTS "division_standing_divisionId_seasonId_idx" ON "public"."division_standing"("divisionId", "seasonId");
CREATE INDEX IF NOT EXISTS "pair_request_recipientId_seasonId_status_idx" ON "public"."pair_request"("recipientId", "seasonId", "status");
CREATE INDEX IF NOT EXISTS "pair_request_requesterId_seasonId_idx" ON "public"."pair_request"("requesterId", "seasonId");
CREATE INDEX IF NOT EXISTS "payment_userId_status_idx" ON "public"."payment"("userId", "status");

-- AddForeignKey
ALTER TABLE "public"."user_activity_log" ADD CONSTRAINT "user_activity_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."admin_status_change" ADD CONSTRAINT "admin_status_change_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."admin_status_change" ADD CONSTRAINT "admin_status_change_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."FeedPost" ADD CONSTRAINT "FeedPost_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."FeedPost" ADD CONSTRAINT "FeedPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."FeedLike" ADD CONSTRAINT "FeedLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."FeedLike" ADD CONSTRAINT "FeedLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."FeedComment" ADD CONSTRAINT "FeedComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."FeedComment" ADD CONSTRAINT "FeedComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
