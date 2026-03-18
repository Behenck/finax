-- CreateEnum
CREATE TYPE "ProductCommissionCalculationBase" AS ENUM ('SALE_TOTAL', 'COMMISSION');

-- AlterTable
ALTER TABLE "product_commissions"
ADD COLUMN "calculation_base" "ProductCommissionCalculationBase" NOT NULL DEFAULT 'SALE_TOTAL',
ADD COLUMN "base_commission_id" TEXT;

-- CreateIndex
CREATE INDEX "product_commissions_base_commission_id_idx" ON "product_commissions"("base_commission_id");

-- AddForeignKey
ALTER TABLE "product_commissions"
ADD CONSTRAINT "product_commissions_base_commission_id_fkey"
FOREIGN KEY ("base_commission_id") REFERENCES "product_commissions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheck
ALTER TABLE "product_commissions"
ADD CONSTRAINT "product_commissions_base_commission_id_check"
CHECK (
	"base_commission_id" IS NULL OR "base_commission_id" <> "id"
);
