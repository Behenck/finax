/*
  Warnings:

  - You are about to drop the column `refunded_by_id` on the `transactions` table. All the data in the column will be lost.
  - Made the column `created_by_id` on table `transactions` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_refunded_by_id_fkey";

-- DropIndex
DROP INDEX "transactions_refunded_by_id_idx";

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "refunded_by_id",
ADD COLUMN     "refunded_by_employee_id" TEXT,
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "created_by_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "transactions_refunded_by_employee_id_idx" ON "transactions"("refunded_by_employee_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_refunded_by_employee_id_fkey" FOREIGN KEY ("refunded_by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
