/*
  Warnings:

  - Added the required column `organization_id` to the `recurrences` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "recurrences" ADD COLUMN     "organization_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
