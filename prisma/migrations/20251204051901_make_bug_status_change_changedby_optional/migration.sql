-- DropForeignKey
ALTER TABLE "public"."bug_status_change" DROP CONSTRAINT "bug_status_change_changedById_fkey";

-- AlterTable
ALTER TABLE "public"."bug_status_change" ALTER COLUMN "changedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."bug_status_change" ADD CONSTRAINT "bug_status_change_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
