/*
  Warnings:

  - You are about to drop the column `actualStartTime` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `proposedTimes` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `resultComment` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledStartTime` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledTime` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the `MatchStats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `match_join_request` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `match_time_slot` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."AdminActionType" AS ENUM ('PLAYER_BAN', 'PLAYER_UNBAN', 'PLAYER_DELETE', 'PLAYER_UPDATE', 'PLAYER_STATUS_CHANGE', 'LEAGUE_CREATE', 'LEAGUE_UPDATE', 'LEAGUE_DELETE', 'LEAGUE_STATUS_CHANGE', 'SEASON_CREATE', 'SEASON_UPDATE', 'SEASON_DELETE', 'SEASON_STATUS_CHANGE', 'DIVISION_CREATE', 'DIVISION_UPDATE', 'DIVISION_DELETE', 'MATCH_VOID', 'MATCH_EDIT_RESULT', 'MATCH_EDIT_SCHEDULE', 'MATCH_WALKOVER', 'DISPUTE_RESOLVE', 'DISPUTE_OVERRIDE', 'SETTINGS_UPDATE', 'BUG_ASSIGN', 'BUG_RESOLVE', 'BUG_UPDATE', 'ADMIN_CREATE', 'ADMIN_UPDATE', 'ADMIN_DELETE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."AdminTargetType" AS ENUM ('PLAYER', 'LEAGUE', 'SEASON', 'DIVISION', 'MATCH', 'DISPUTE', 'SETTINGS', 'BUG_REPORT', 'ADMIN', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."TeamChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."MatchFeeType" AS ENUM ('FREE', 'SPLIT', 'FIXED');

-- CreateEnum
CREATE TYPE "public"."MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."FeatureAnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."OnboardingStep" AS ENUM ('PERSONAL_INFO', 'LOCATION', 'GAME_SELECT', 'SKILL_ASSESSMENT', 'ASSESSMENT_RESULTS', 'PROFILE_PICTURE');

-- AlterEnum
ALTER TYPE "public"."DisputeResolutionAction" ADD VALUE 'REJECT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."DivisionLevel" ADD VALUE 'IMPROVER';
ALTER TYPE "public"."DivisionLevel" ADD VALUE 'UPPER_INTERMEDIATE';
ALTER TYPE "public"."DivisionLevel" ADD VALUE 'EXPERT';

-- AlterEnum
ALTER TYPE "public"."PartnershipStatus" ADD VALUE 'INCOMPLETE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."PaymentStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "public"."PaymentStatus" ADD VALUE 'REFUNDED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."StatusChangeReason" ADD VALUE 'ADMIN_BAN';
ALTER TYPE "public"."StatusChangeReason" ADD VALUE 'ADMIN_UNBAN';
ALTER TYPE "public"."StatusChangeReason" ADD VALUE 'ADMIN_DELETE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."UserStatus" ADD VALUE 'BANNED';
ALTER TYPE "public"."UserStatus" ADD VALUE 'DELETED';

-- DropForeignKey
ALTER TABLE "public"."MatchStats" DROP CONSTRAINT "MatchStats_matchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."match_join_request" DROP CONSTRAINT "match_join_request_matchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."match_join_request" DROP CONSTRAINT "match_join_request_requesterId_fkey";

-- DropForeignKey
ALTER TABLE "public"."match_join_request" DROP CONSTRAINT "match_join_request_respondedBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."match_time_slot" DROP CONSTRAINT "match_time_slot_matchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."match_time_slot" DROP CONSTRAINT "match_time_slot_proposedById_fkey";

-- DropIndex
DROP INDEX "public"."Match_scheduledStartTime_idx";

-- AlterTable
ALTER TABLE "public"."Match" DROP COLUMN "actualStartTime",
DROP COLUMN "proposedTimes",
DROP COLUMN "resultComment",
DROP COLUMN "scheduledStartTime",
DROP COLUMN "scheduledTime",
ADD COLUMN     "fee" "public"."MatchFeeType" DEFAULT 'FREE',
ADD COLUMN     "feeAmount" DECIMAL(10,2),
ADD COLUMN     "genderRestriction" "public"."GenderRestriction",
ADD COLUMN     "isFriendly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFriendlyRequest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requestExpiresAt" TIMESTAMP(3),
ADD COLUMN     "requestRecipientId" TEXT,
ADD COLUMN     "requestStatus" "public"."InvitationStatus",
ADD COLUMN     "skillLevels" TEXT[];

-- AlterTable
ALTER TABLE "public"."notification" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "public"."partnership" ADD COLUMN     "predecessorId" TEXT,
ALTER COLUMN "partnerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."user" ADD COLUMN     "onboardingStep" "public"."OnboardingStep";

-- DropTable
DROP TABLE "public"."MatchStats";

-- DropTable
DROP TABLE "public"."match_join_request";

-- DropTable
DROP TABLE "public"."match_time_slot";

-- CreateTable
CREATE TABLE "public"."user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifications" BOOLEAN NOT NULL DEFAULT true,
    "matchReminders" BOOLEAN NOT NULL DEFAULT true,
    "locationServices" BOOLEAN NOT NULL DEFAULT false,
    "hapticFeedback" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admin_log" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "actionType" "public"."AdminActionType" NOT NULL,
    "targetType" "public"."AdminTargetType" NOT NULL,
    "targetId" TEXT,
    "description" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TeamChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentDivisionId" TEXT NOT NULL,
    "requestedDivisionId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "public"."TeamChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MatchComment" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_maintenance" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "status" "public"."MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "affectedServices" TEXT[],
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "completionSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feature_announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "featureDetails" JSONB,
    "releaseDate" TIMESTAMP(3),
    "announcementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."FeatureAnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "targetAudience" TEXT[],
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "paymentMethod" TEXT,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "userId" TEXT,
    "seasonId" TEXT,
    "seasonMembershipId" TEXT,
    "fiuuTransactionId" TEXT,
    "fiuuChannel" TEXT,
    "fiuuStatusCode" TEXT,
    "fiuuMessage" TEXT,
    "verificationHash" TEXT,
    "metadata" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "public"."user_settings"("userId");

-- CreateIndex
CREATE INDEX "user_settings_userId_idx" ON "public"."user_settings"("userId");

-- CreateIndex
CREATE INDEX "admin_log_adminId_createdAt_idx" ON "public"."admin_log"("adminId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "admin_log_actionType_createdAt_idx" ON "public"."admin_log"("actionType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "admin_log_targetType_targetId_idx" ON "public"."admin_log"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "admin_log_createdAt_idx" ON "public"."admin_log"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "TeamChangeRequest_userId_idx" ON "public"."TeamChangeRequest"("userId");

-- CreateIndex
CREATE INDEX "TeamChangeRequest_seasonId_idx" ON "public"."TeamChangeRequest"("seasonId");

-- CreateIndex
CREATE INDEX "TeamChangeRequest_status_idx" ON "public"."TeamChangeRequest"("status");

-- CreateIndex
CREATE INDEX "TeamChangeRequest_currentDivisionId_idx" ON "public"."TeamChangeRequest"("currentDivisionId");

-- CreateIndex
CREATE INDEX "TeamChangeRequest_requestedDivisionId_idx" ON "public"."TeamChangeRequest"("requestedDivisionId");

-- CreateIndex
CREATE INDEX "MatchComment_matchId_idx" ON "public"."MatchComment"("matchId");

-- CreateIndex
CREATE INDEX "MatchComment_userId_idx" ON "public"."MatchComment"("userId");

-- CreateIndex
CREATE INDEX "MatchComment_createdAt_idx" ON "public"."MatchComment"("createdAt");

-- CreateIndex
CREATE INDEX "system_maintenance_startDateTime_idx" ON "public"."system_maintenance"("startDateTime");

-- CreateIndex
CREATE INDEX "system_maintenance_endDateTime_idx" ON "public"."system_maintenance"("endDateTime");

-- CreateIndex
CREATE INDEX "system_maintenance_status_idx" ON "public"."system_maintenance"("status");

-- CreateIndex
CREATE INDEX "feature_announcement_status_idx" ON "public"."feature_announcement"("status");

-- CreateIndex
CREATE INDEX "feature_announcement_announcementDate_idx" ON "public"."feature_announcement"("announcementDate");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orderId_key" ON "public"."payment"("orderId");

-- CreateIndex
CREATE INDEX "payment_userId_idx" ON "public"."payment"("userId");

-- CreateIndex
CREATE INDEX "payment_seasonId_idx" ON "public"."payment"("seasonId");

-- CreateIndex
CREATE INDEX "payment_seasonMembershipId_idx" ON "public"."payment"("seasonMembershipId");

-- CreateIndex
CREATE INDEX "payment_status_idx" ON "public"."payment"("status");

-- CreateIndex
CREATE INDEX "Match_isFriendly_idx" ON "public"."Match"("isFriendly");

-- CreateIndex
CREATE INDEX "Match_genderRestriction_idx" ON "public"."Match"("genderRestriction");

-- CreateIndex
CREATE INDEX "Match_isFriendlyRequest_idx" ON "public"."Match"("isFriendlyRequest");

-- CreateIndex
CREATE INDEX "Match_requestStatus_idx" ON "public"."Match"("requestStatus");

-- CreateIndex
CREATE INDEX "Match_requestExpiresAt_idx" ON "public"."Match"("requestExpiresAt");

-- CreateIndex
CREATE INDEX "partnership_predecessorId_idx" ON "public"."partnership"("predecessorId");

-- AddForeignKey
ALTER TABLE "public"."user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_log" ADD CONSTRAINT "admin_log_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamChangeRequest" ADD CONSTRAINT "TeamChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamChangeRequest" ADD CONSTRAINT "TeamChangeRequest_currentDivisionId_fkey" FOREIGN KEY ("currentDivisionId") REFERENCES "public"."division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamChangeRequest" ADD CONSTRAINT "TeamChangeRequest_requestedDivisionId_fkey" FOREIGN KEY ("requestedDivisionId") REFERENCES "public"."division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamChangeRequest" ADD CONSTRAINT "TeamChangeRequest_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamChangeRequest" ADD CONSTRAINT "TeamChangeRequest_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatchComment" ADD CONSTRAINT "MatchComment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatchComment" ADD CONSTRAINT "MatchComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."partnership" ADD CONSTRAINT "partnership_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "public"."partnership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment" ADD CONSTRAINT "payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment" ADD CONSTRAINT "payment_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment" ADD CONSTRAINT "payment_seasonMembershipId_fkey" FOREIGN KEY ("seasonMembershipId") REFERENCES "public"."SeasonMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
