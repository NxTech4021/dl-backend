-- CreateEnum
CREATE TYPE "public"."LeagueStatus" AS ENUM ('DRAFT', 'REGISTRATION', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."LeagueDurationUnit" AS ENUM ('WEEKS', 'MONTHS');

-- CreateEnum
CREATE TYPE "public"."LeagueJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- AlterTable
ALTER TABLE "public"."Season" ADD COLUMN     "leagueId" TEXT;

-- CreateTable
CREATE TABLE "public"."League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "status" "public"."LeagueStatus" NOT NULL DEFAULT 'DRAFT',
    "location" TEXT NOT NULL,
    "description" TEXT,
    "brandingLogoUrl" TEXT,
    "brandingPrimaryColor" TEXT,
    "brandingSecondaryColor" TEXT,
    "theme" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeagueSettings" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "durationUnit" "public"."LeagueDurationUnit" NOT NULL DEFAULT 'WEEKS',
    "durationValue" INTEGER,
    "minPlayersPerDivision" INTEGER,
    "maxPlayersPerDivision" INTEGER,
    "registrationDeadlineDays" INTEGER,
    "paymentSettings" JSONB,
    "divisionRules" JSONB,
    "playoffConfiguration" JSONB,
    "finalsConfiguration" JSONB,
    "workflowConfiguration" JSONB,
    "templates" JSONB,
    "customRulesText" TEXT,
    "branding" JSONB,
    "integrationSettings" JSONB,
    "bulkOperations" JSONB,
    "archiveRetentionMonths" INTEGER,
    "validationRules" JSONB,
    "errorHandling" JSONB,
    "previewPayload" JSONB,
    "previewExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeagueSettingsAudit" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "adminId" TEXT,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueSettingsAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeagueJoinRequest" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."LeagueJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "decisionReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeagueTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "description" TEXT,
    "settings" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeagueSettings_leagueId_key" ON "public"."LeagueSettings"("leagueId");

-- CreateIndex
CREATE INDEX "LeagueSettingsAudit_settingsId_idx" ON "public"."LeagueSettingsAudit"("settingsId");

-- CreateIndex
CREATE INDEX "LeagueSettingsAudit_adminId_idx" ON "public"."LeagueSettingsAudit"("adminId");

-- CreateIndex
CREATE INDEX "LeagueJoinRequest_leagueId_idx" ON "public"."LeagueJoinRequest"("leagueId");

-- CreateIndex
CREATE INDEX "LeagueJoinRequest_userId_idx" ON "public"."LeagueJoinRequest"("userId");

-- CreateIndex
CREATE INDEX "LeagueJoinRequest_status_idx" ON "public"."LeagueJoinRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueJoinRequest_leagueId_userId_key" ON "public"."LeagueJoinRequest"("leagueId", "userId");

-- CreateIndex
CREATE INDEX "LeagueTemplate_sport_idx" ON "public"."LeagueTemplate"("sport");

-- CreateIndex
CREATE INDEX "Season_leagueId_idx" ON "public"."Season"("leagueId");

-- AddForeignKey
ALTER TABLE "public"."LeagueSettings" ADD CONSTRAINT "LeagueSettings_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeagueSettingsAudit" ADD CONSTRAINT "LeagueSettingsAudit_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "public"."LeagueSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeagueSettingsAudit" ADD CONSTRAINT "LeagueSettingsAudit_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeagueJoinRequest" ADD CONSTRAINT "LeagueJoinRequest_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeagueJoinRequest" ADD CONSTRAINT "LeagueJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeagueJoinRequest" ADD CONSTRAINT "LeagueJoinRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeagueTemplate" ADD CONSTRAINT "LeagueTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Season" ADD CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE SET NULL ON UPDATE CASCADE;
