/*
  Warnings:

  - You are about to drop the column `sportId` on the `League` table. All the data in the column will be lost.
  - You are about to alter the column `name` on the `League` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `name` on the `Season` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - Added the required column `leagueSportId` to the `Season` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Sport` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."League" DROP CONSTRAINT "League_sportId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Season" DROP CONSTRAINT "Season_leagueId_fkey";

-- AlterTable
ALTER TABLE "public"."League" DROP COLUMN "sportId",
ADD COLUMN     "description" TEXT,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "status" SET DEFAULT 'UPCOMING';

-- AlterTable
ALTER TABLE "public"."Season" ADD COLUMN     "leagueSportId" INTEGER NOT NULL,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "entryFee" DROP NOT NULL,
ALTER COLUMN "lastRegistration" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'UPCOMING';

-- AlterTable
ALTER TABLE "public"."Sport" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."LeagueSport" (
    "id" SERIAL NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "sportId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueSport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeagueSport_leagueId_idx" ON "public"."LeagueSport"("leagueId");

-- CreateIndex
CREATE INDEX "LeagueSport_sportId_idx" ON "public"."LeagueSport"("sportId");

-- CreateIndex
CREATE INDEX "LeagueSport_isActive_idx" ON "public"."LeagueSport"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueSport_leagueId_sportId_key" ON "public"."LeagueSport"("leagueId", "sportId");

-- CreateIndex
CREATE INDEX "League_location_idx" ON "public"."League"("location");

-- CreateIndex
CREATE INDEX "League_status_idx" ON "public"."League"("status");

-- CreateIndex
CREATE INDEX "Season_leagueId_idx" ON "public"."Season"("leagueId");

-- CreateIndex
CREATE INDEX "Season_leagueSportId_idx" ON "public"."Season"("leagueSportId");

-- CreateIndex
CREATE INDEX "Season_leagueTypeId_idx" ON "public"."Season"("leagueTypeId");

-- CreateIndex
CREATE INDEX "Season_status_idx" ON "public"."Season"("status");

-- CreateIndex
CREATE INDEX "Season_startDate_idx" ON "public"."Season"("startDate");

-- CreateIndex
CREATE INDEX "Sport_name_idx" ON "public"."Sport"("name");

-- AddForeignKey
ALTER TABLE "public"."LeagueSport" ADD CONSTRAINT "LeagueSport_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeagueSport" ADD CONSTRAINT "LeagueSport_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "public"."Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Season" ADD CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Season" ADD CONSTRAINT "Season_leagueSportId_fkey" FOREIGN KEY ("leagueSportId") REFERENCES "public"."LeagueSport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
