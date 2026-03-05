-- CreateEnum
CREATE TYPE "SaleCommissionDirection" AS ENUM ('INCOME', 'OUTCOME');

-- AlterTable
ALTER TABLE "sale_commissions"
ADD COLUMN "direction" "SaleCommissionDirection" NOT NULL DEFAULT 'OUTCOME';

-- Backfill existing rows based on recipient type
UPDATE "sale_commissions"
SET "direction" = CASE
  WHEN "recipient_type" IN ('COMPANY', 'UNIT') THEN 'INCOME'::"SaleCommissionDirection"
  ELSE 'OUTCOME'::"SaleCommissionDirection"
END;

-- Remove technical default after backfill
ALTER TABLE "sale_commissions"
ALTER COLUMN "direction" DROP DEFAULT;
