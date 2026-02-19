/*
  Warnings:

  - Made the column `documentType` on table `partners` required. This step will fail if there are existing NULL values in that column.
  - Made the column `document` on table `partners` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "partners" ALTER COLUMN "documentType" SET NOT NULL,
ALTER COLUMN "document" SET NOT NULL;
