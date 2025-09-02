/*
  Warnings:

  - You are about to drop the `AdminInvite` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."AdminStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "area" TEXT,
ADD COLUMN     "completedOnboarding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActivityCheck" TIMESTAMP(3),
ADD COLUMN     "lastLogin" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- DropTable
DROP TABLE "public"."AdminInvite";

-- CreateTable
CREATE TABLE "public"."Admin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."AdminStatus" NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminInviteToken" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminInviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Match" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "playerScore" INTEGER NOT NULL,
    "opponentScore" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "matchDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "notes" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MatchStats" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerAces" INTEGER,
    "playerUnforcedErrors" INTEGER,
    "playerWinners" INTEGER,
    "playerDoubleFaults" INTEGER,
    "opponentAces" INTEGER,
    "opponentUnforcedErrors" INTEGER,
    "opponentWinners" INTEGER,
    "opponentDoubleFaults" INTEGER,
    "rallyCount" INTEGER,
    "longestRally" INTEGER,
    "breakPointsConverted" INTEGER,
    "breakPointsTotal" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_userId_key" ON "public"."Admin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminInviteToken_adminId_key" ON "public"."AdminInviteToken"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminInviteToken_token_key" ON "public"."AdminInviteToken"("token");

-- CreateIndex
CREATE INDEX "Match_playerId_idx" ON "public"."Match"("playerId");

-- CreateIndex
CREATE INDEX "Match_opponentId_idx" ON "public"."Match"("opponentId");

-- CreateIndex
CREATE INDEX "Match_sport_idx" ON "public"."Match"("sport");

-- CreateIndex
CREATE INDEX "Match_matchDate_idx" ON "public"."Match"("matchDate");

-- CreateIndex
CREATE UNIQUE INDEX "MatchStats_matchId_key" ON "public"."MatchStats"("matchId");

-- AddForeignKey
ALTER TABLE "public"."Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminInviteToken" ADD CONSTRAINT "AdminInviteToken_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatchStats" ADD CONSTRAINT "MatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
