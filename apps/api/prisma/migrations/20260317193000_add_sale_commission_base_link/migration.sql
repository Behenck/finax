-- CreateEnum
CREATE TYPE "SaleCommissionCalculationBase" AS ENUM ('SALE_TOTAL', 'COMMISSION');

-- AlterTable
ALTER TABLE "sale_commissions"
ADD COLUMN "calculation_base" "SaleCommissionCalculationBase" NOT NULL DEFAULT 'SALE_TOTAL',
ADD COLUMN "base_commission_id" TEXT;

-- CreateIndex
CREATE INDEX "sale_commissions_base_commission_id_idx" ON "sale_commissions"("base_commission_id");

-- AddForeignKey
ALTER TABLE "sale_commissions"
ADD CONSTRAINT "sale_commissions_base_commission_id_fkey"
FOREIGN KEY ("base_commission_id") REFERENCES "sale_commissions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheck
ALTER TABLE "sale_commissions"
ADD CONSTRAINT "sale_commissions_base_commission_id_check"
CHECK (
	"base_commission_id" IS NULL OR "base_commission_id" <> "id"
);
