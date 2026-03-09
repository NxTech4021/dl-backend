-- Fix migration: Apply missing changes from failed achievement_system_redesign

-- Create missing enums
DO $$ BEGIN
    CREATE TYPE "public"."UserActionType" AS ENUM ('MATCH_CREATE', 'MATCH_JOIN', 'MATCH_CANCEL', 'MATCH_LEAVE', 'SCORE_SUBMIT', 'SCORE_CONFIRM', 'SCORE_DISPUTE', 'WALKOVER_REPORT', 'WALKOVER_CONFIRM', 'PAIR_REQUEST_SEND', 'PAIR_REQUEST_ACCEPT', 'PAIR_REQUEST_DENY', 'PARTNERSHIP_DISSOLVE', 'SEASON_REGISTER', 'SEASON_WITHDRAW', 'INVITATION_RESPOND_ACCEPT', 'INVITATION_RESPOND_DECLINE', 'PAYMENT_COMPLETE', 'PAYMENT_FAIL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."UserTargetType" AS ENUM ('MATCH', 'SEASON', 'PARTNERSHIP', 'INVITATION', 'PAYMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."AchievementCategory" AS ENUM ('MATCH_COUNTER', 'LEAGUE_SEASON', 'WINNING', 'MULTI_SPORT', 'MATCH_STREAK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."AchievementScope" AS ENUM ('MATCH', 'SEASON', 'LIFETIME');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum (safe - won't fail if already exists)
ALTER TYPE "public"."AdminActionType" ADD VALUE IF NOT EXISTS 'ADMIN_SUSPEND';
ALTER TYPE "public"."AdminActionType" ADD VALUE IF NOT EXISTS 'ADMIN_ACTIVATE';
ALTER TYPE "public"."AdminActionType" ADD VALUE IF NOT EXISTS 'PAYMENT_STATUS_UPDATE';
ALTER TYPE "public"."AdminActionType" ADD VALUE IF NOT EXISTS 'PAYMENT_BULK_UPDATE';
ALTER TYPE "public"."AdminTargetType" ADD VALUE IF NOT EXISTS 'PAYMENT';
ALTER TYPE "public"."GenderType" ADD VALUE IF NOT EXISTS 'OPEN';
ALTER TYPE "public"."StatusChangeReason" ADD VALUE IF NOT EXISTS 'ADMIN_SUSPEND';
ALTER TYPE "public"."StatusChangeReason" ADD VALUE IF NOT EXISTS 'ADMIN_ACTIVATE';
ALTER TYPE "public"."TierType" ADD VALUE IF NOT EXISTS 'NONE';

-- Drop old index if exists
DROP INDEX IF EXISTS "public"."UserAchievement_userId_idx";
DROP INDEX IF EXISTS "public"."verification_value_key";

-- Achievement table changes
ALTER TABLE "public"."Achievement" ADD COLUMN IF NOT EXISTS "badgeGroup" TEXT;
ALTER TABLE "public"."Achievement" ADD COLUMN IF NOT EXISTS "evaluatorKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "public"."Achievement" ADD COLUMN IF NOT EXISTS "gameTypeFilter" "public"."GameType";
ALTER TABLE "public"."Achievement" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."Achievement" ADD COLUMN IF NOT EXISTS "isRevocable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."Achievement" ADD COLUMN IF NOT EXISTS "scope" "public"."AchievementScope" NOT NULL DEFAULT 'LIFETIME';
ALTER TABLE "public"."Achievement" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."Achievement" ADD COLUMN IF NOT EXISTS "sportFilter" "public"."SportType";
ALTER TABLE "public"."Achievement" ADD COLUMN IF NOT EXISTS "threshold" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "public"."Achievement" ADD COLUMN IF NOT EXISTS "tier" "public"."TierType" NOT NULL DEFAULT 'BRONZE';

-- Drop old category and add new one (need to handle existing data)
ALTER TABLE "public"."Achievement" DROP COLUMN IF EXISTS "category";
ALTER TABLE "public"."Achievement" ADD COLUMN IF NOT EXISTS "category" "public"."AchievementCategory" NOT NULL DEFAULT 'WINNING';

-- Drop requirement column
ALTER TABLE "public"."Achievement" DROP COLUMN IF EXISTS "requirement";

-- Fix icon to NOT NULL (set default for any nulls first)
UPDATE "public"."Achievement" SET "icon" = 'trophy' WHERE "icon" IS NULL;
ALTER TABLE "public"."Achievement" ALTER COLUMN "icon" SET NOT NULL;

-- UserAchievement changes
ALTER TABLE "public"."UserAchievement" ALTER COLUMN "unlockedAt" DROP NOT NULL;
ALTER TABLE "public"."UserAchievement" ALTER COLUMN "unlockedAt" DROP DEFAULT;
ALTER TABLE "public"."UserAchievement" DROP COLUMN IF EXISTS "progress";
ALTER TABLE "public"."UserAchievement" ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."UserAchievement" ALTER COLUMN "isCompleted" SET DEFAULT false;

-- user_settings skill levels
ALTER TABLE "public"."user_settings" ADD COLUMN IF NOT EXISTS "padelSkillLevel" "public"."SkillLevel";
ALTER TABLE "public"."user_settings" ADD COLUMN IF NOT EXISTS "pickleballSkillLevel" "public"."SkillLevel";
ALTER TABLE "public"."user_settings" ADD COLUMN IF NOT EXISTS "tennisSkillLevel" "public"."SkillLevel";

-- Create missing tables
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

-- Create indexes
CREATE INDEX IF NOT EXISTS "user_activity_log_userId_createdAt_idx" ON "public"."user_activity_log"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "user_activity_log_targetId_createdAt_idx" ON "public"."user_activity_log"("targetId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "user_activity_log_actionType_createdAt_idx" ON "public"."user_activity_log"("actionType", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "user_activity_log_createdAt_idx" ON "public"."user_activity_log"("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "admin_status_change_adminId_createdAt_idx" ON "public"."admin_status_change"("adminId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "admin_status_change_newStatus_idx" ON "public"."admin_status_change"("newStatus");
CREATE INDEX IF NOT EXISTS "admin_status_change_reason_idx" ON "public"."admin_status_change"("reason");

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

-- Add foreign keys
ALTER TABLE "public"."user_activity_log" DROP CONSTRAINT IF EXISTS "user_activity_log_userId_fkey";
ALTER TABLE "public"."user_activity_log" ADD CONSTRAINT "user_activity_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."admin_status_change" DROP CONSTRAINT IF EXISTS "admin_status_change_adminId_fkey";
ALTER TABLE "public"."admin_status_change" ADD CONSTRAINT "admin_status_change_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."admin_status_change" DROP CONSTRAINT IF EXISTS "admin_status_change_triggeredById_fkey";
ALTER TABLE "public"."admin_status_change" ADD CONSTRAINT "admin_status_change_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
