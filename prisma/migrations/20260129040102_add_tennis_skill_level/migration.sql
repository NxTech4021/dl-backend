-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'IMPROVER', 'INTERMEDIATE', 'UPPER_INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- AlterEnum
ALTER TYPE "GenderType" ADD VALUE 'OPEN';

-- DropIndex
DROP INDEX "verification_value_key";

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "padelSkillLevel" "SkillLevel",
ADD COLUMN     "pickleballSkillLevel" "SkillLevel",
ADD COLUMN     "tennisSkillLevel" "SkillLevel";

-- CreateTable
CREATE TABLE "FeedPost" (
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
CREATE TABLE "FeedLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedComment" (
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
CREATE INDEX "FeedPost_authorId_idx" ON "FeedPost"("authorId");

-- CreateIndex
CREATE INDEX "FeedPost_matchId_idx" ON "FeedPost"("matchId");

-- CreateIndex
CREATE INDEX "FeedPost_sport_idx" ON "FeedPost"("sport");

-- CreateIndex
CREATE INDEX "FeedPost_createdAt_idx" ON "FeedPost"("createdAt");

-- CreateIndex
CREATE INDEX "FeedPost_isDeleted_createdAt_idx" ON "FeedPost"("isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "FeedLike_postId_idx" ON "FeedLike"("postId");

-- CreateIndex
CREATE INDEX "FeedLike_userId_idx" ON "FeedLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedLike_postId_userId_key" ON "FeedLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "FeedComment_postId_idx" ON "FeedComment"("postId");

-- CreateIndex
CREATE INDEX "FeedComment_authorId_idx" ON "FeedComment"("authorId");

-- CreateIndex
CREATE INDEX "FeedComment_postId_isDeleted_createdAt_idx" ON "FeedComment"("postId", "isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "Match_divisionId_seasonId_status_idx" ON "Match"("divisionId", "seasonId", "status");

-- CreateIndex
CREATE INDEX "SeasonMembership_userId_seasonId_idx" ON "SeasonMembership"("userId", "seasonId");

-- CreateIndex
CREATE INDEX "SeasonMembership_seasonId_status_idx" ON "SeasonMembership"("seasonId", "status");

-- CreateIndex
CREATE INDEX "division_standing_divisionId_seasonId_idx" ON "division_standing"("divisionId", "seasonId");

-- CreateIndex
CREATE INDEX "pair_request_recipientId_seasonId_status_idx" ON "pair_request"("recipientId", "seasonId", "status");

-- CreateIndex
CREATE INDEX "pair_request_requesterId_seasonId_idx" ON "pair_request"("requesterId", "seasonId");

-- CreateIndex
CREATE INDEX "payment_userId_status_idx" ON "payment"("userId", "status");

-- AddForeignKey
ALTER TABLE "FeedPost" ADD CONSTRAINT "FeedPost_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedPost" ADD CONSTRAINT "FeedPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedLike" ADD CONSTRAINT "FeedLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedLike" ADD CONSTRAINT "FeedLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedComment" ADD CONSTRAINT "FeedComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedComment" ADD CONSTRAINT "FeedComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
