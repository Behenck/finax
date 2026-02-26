/*
  Warnings:

  - You are about to drop the `UserCompanyAccess` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'SELLER';
ALTER TYPE "Role" ADD VALUE 'PARTNER';

-- DropForeignKey
ALTER TABLE "UserCompanyAccess" DROP CONSTRAINT "UserCompanyAccess_company_id_fkey";

-- DropForeignKey
ALTER TABLE "UserCompanyAccess" DROP CONSTRAINT "UserCompanyAccess_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "UserCompanyAccess" DROP CONSTRAINT "UserCompanyAccess_user_id_fkey";

-- DropTable
DROP TABLE "UserCompanyAccess";

-- CreateTable
CREATE TABLE "member_company_access" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "unit_id" TEXT,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_company_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_company_access_member_id_idx" ON "member_company_access"("member_id");

-- CreateIndex
CREATE INDEX "member_company_access_company_id_idx" ON "member_company_access"("company_id");

-- CreateIndex
CREATE INDEX "member_company_access_unit_id_idx" ON "member_company_access"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_company_access_member_id_company_id_unit_id_key" ON "member_company_access"("member_id", "company_id", "unit_id");

-- AddForeignKey
ALTER TABLE "member_company_access" ADD CONSTRAINT "member_company_access_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_company_access" ADD CONSTRAINT "member_company_access_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_company_access" ADD CONSTRAINT "member_company_access_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_company_access" ADD CONSTRAINT "member_company_access_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
