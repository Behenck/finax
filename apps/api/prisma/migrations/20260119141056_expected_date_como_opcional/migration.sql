/*
  Warnings:

  - Made the column `expected_payment_date` on table `transactions` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "expected_payment_date" SET NOT NULL;
