-- AlterTable
ALTER TABLE "public"."division_standing" ADD COLUMN     "disbandedAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
