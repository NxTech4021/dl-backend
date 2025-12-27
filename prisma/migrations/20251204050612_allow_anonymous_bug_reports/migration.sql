-- DropForeignKey
ALTER TABLE "public"."bug_report" DROP CONSTRAINT "bug_report_reporterId_fkey";

-- AlterTable
ALTER TABLE "public"."bug_report" ADD COLUMN     "anonymousEmail" TEXT,
ADD COLUMN     "anonymousName" TEXT,
ALTER COLUMN "reporterId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."bug_report" ADD CONSTRAINT "bug_report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
