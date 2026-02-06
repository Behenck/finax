/*
  Warnings:

  - Added the required column `created_by_id` to the `recurrences` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "recurrences" ADD COLUMN     "created_by_id" TEXT NOT NULL,
ALTER COLUMN "execution_day_type" SET DEFAULT 'CALENDAR_DAY',
ALTER COLUMN "adjustment_rule" SET DEFAULT 'NONE',
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AddForeignKey
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
