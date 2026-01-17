/*
  Warnings:

  - You are about to drop the column `title` on the `transactions` table. All the data in the column will be lost.
  - Made the column `description` on table `transactions` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "title",
ADD COLUMN     "notes" TEXT,
ALTER COLUMN "description" SET NOT NULL;
