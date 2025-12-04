-- CreateEnum
CREATE TYPE "public"."MatchReportCategory" AS ENUM ('FAKE_MATCH', 'RATING_MANIPULATION', 'INAPPROPRIATE_CONTENT', 'HARASSMENT', 'SPAM', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."MatchAdminActionType" ADD VALUE 'HIDE_MATCH';
ALTER TYPE "public"."MatchAdminActionType" ADD VALUE 'UNHIDE_MATCH';
ALTER TYPE "public"."MatchAdminActionType" ADD VALUE 'REPORT_ABUSE';
ALTER TYPE "public"."MatchAdminActionType" ADD VALUE 'CLEAR_REPORT';

-- AlterTable
ALTER TABLE "public"."Match" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenByAdminId" TEXT,
ADD COLUMN     "hiddenReason" TEXT,
ADD COLUMN     "isHiddenFromPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isReportedForAbuse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportCategory" "public"."MatchReportCategory",
ADD COLUMN     "reportReason" TEXT,
ADD COLUMN     "reportedAt" TIMESTAMP(3),
ADD COLUMN     "reportedByAdminId" TEXT;

-- CreateTable
CREATE TABLE "public"."user_push_token" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_push_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admin_message_log" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "matchId" TEXT,
    "seasonId" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipientIds" TEXT[],
    "sendEmail" BOOLEAN NOT NULL DEFAULT false,
    "sendPush" BOOLEAN NOT NULL DEFAULT false,
    "inAppCount" INTEGER NOT NULL DEFAULT 0,
    "emailCount" INTEGER NOT NULL DEFAULT 0,
    "emailSkipped" INTEGER NOT NULL DEFAULT 0,
    "pushCount" INTEGER NOT NULL DEFAULT 0,
    "pushSkipped" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_message_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_push_token_token_key" ON "public"."user_push_token"("token");

-- CreateIndex
CREATE INDEX "user_push_token_userId_idx" ON "public"."user_push_token"("userId");

-- CreateIndex
CREATE INDEX "user_push_token_platform_idx" ON "public"."user_push_token"("platform");

-- CreateIndex
CREATE INDEX "user_push_token_isActive_idx" ON "public"."user_push_token"("isActive");

-- CreateIndex
CREATE INDEX "admin_message_log_adminId_idx" ON "public"."admin_message_log"("adminId");

-- CreateIndex
CREATE INDEX "admin_message_log_matchId_idx" ON "public"."admin_message_log"("matchId");

-- CreateIndex
CREATE INDEX "admin_message_log_createdAt_idx" ON "public"."admin_message_log"("createdAt");

-- CreateIndex
CREATE INDEX "Match_isHiddenFromPublic_idx" ON "public"."Match"("isHiddenFromPublic");

-- CreateIndex
CREATE INDEX "Match_isReportedForAbuse_idx" ON "public"."Match"("isReportedForAbuse");

-- AddForeignKey
ALTER TABLE "public"."user_push_token" ADD CONSTRAINT "user_push_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_message_log" ADD CONSTRAINT "admin_message_log_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_message_log" ADD CONSTRAINT "admin_message_log_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
