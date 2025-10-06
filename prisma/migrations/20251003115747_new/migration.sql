/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `LeagueType` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."LeagueType" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sortOrder" INTEGER;

-- AlterTable
ALTER TABLE "public"."Sport" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sortOrder" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "LeagueType_name_key" ON "public"."LeagueType"("name");

-- CreateIndex
CREATE INDEX "LeagueType_isActive_sortOrder_idx" ON "public"."LeagueType"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "LeagueType_type_gender_idx" ON "public"."LeagueType"("type", "gender");

-- CreateIndex
CREATE INDEX "Sport_isActive_sortOrder_idx" ON "public"."Sport"("isActive", "sortOrder");
