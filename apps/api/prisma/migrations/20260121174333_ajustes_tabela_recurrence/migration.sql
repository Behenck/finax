/*
  Warnings:

  - You are about to drop the column `frequency` on the `recurrences` table. All the data in the column will be lost.
  - Added the required column `cost_center_id` to the `recurrences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `interval` to the `recurrences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `recurrences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `recurrences` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RecurrenceStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- DropIndex
DROP INDEX "recurrences_frequency_execution_day_type_idx";

-- DropIndex
DROP INDEX "recurrences_start_date_end_date_idx";

-- AlterTable
ALTER TABLE "recurrences" DROP COLUMN "frequency",
ADD COLUMN     "cost_center_id" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "interval" INTEGER NOT NULL,
ADD COLUMN     "last_run_at" TIMESTAMP(3),
ADD COLUMN     "status" "RecurrenceStatus" NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "recurrences_status_start_date_end_date_last_run_at_idx" ON "recurrences"("status", "start_date", "end_date", "last_run_at");

-- CreateIndex
CREATE INDEX "recurrences_company_id_status_idx" ON "recurrences"("company_id", "status");

-- CreateIndex
CREATE INDEX "recurrences_cost_center_id_idx" ON "recurrences"("cost_center_id");

-- CreateIndex
CREATE INDEX "recurrences_interval_execution_day_type_idx" ON "recurrences"("interval", "execution_day_type");
