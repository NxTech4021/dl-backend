/*
  Warnings:

  - A unique constraint covering the columns `[userId,sport]` on the table `QuestionnaireResponse` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "public"."SeasonStatus" ADD VALUE IF NOT EXISTS 'REGISTER_INTEREST';

-- DropForeignKey
ALTER TABLE "public"."MatchParticipant" DROP CONSTRAINT "MatchParticipant_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_senderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."division_standing" DROP CONSTRAINT "division_standing_userId_fkey";

-- DropIndex
DROP INDEX "public"."MatchParticipant_matchId_userId_key";

-- AlterTable
ALTER TABLE "public"."Achievement" ALTER COLUMN "evaluatorKey" DROP DEFAULT,
ALTER COLUMN "category" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."League" ADD COLUMN     "rules" TEXT;

-- AlterTable
ALTER TABLE "public"."MatchParticipant" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Message" ALTER COLUMN "senderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."user" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "MatchParticipant_matchId_userId_idx" ON "public"."MatchParticipant"("matchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireResponse_userId_sport_key" ON "public"."QuestionnaireResponse"("userId", "sport");

-- AddForeignKey
ALTER TABLE "public"."MatchParticipant" ADD CONSTRAINT "MatchParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."division_standing" ADD CONSTRAINT "division_standing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
