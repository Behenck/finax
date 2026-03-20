-- CreateEnum
CREATE TYPE "MemberDataScope" AS ENUM (
    'LINKED_ONLY',
    'COMPANY_ONLY',
    'ORGANIZATION_ALL'
);

-- AlterTable
ALTER TABLE "members"
ADD COLUMN "customers_scope" "MemberDataScope" NOT NULL DEFAULT 'ORGANIZATION_ALL',
ADD COLUMN "sales_scope" "MemberDataScope" NOT NULL DEFAULT 'ORGANIZATION_ALL',
ADD COLUMN "commissions_scope" "MemberDataScope" NOT NULL DEFAULT 'ORGANIZATION_ALL';
