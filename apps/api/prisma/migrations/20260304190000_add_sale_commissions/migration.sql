-- CreateEnum
CREATE TYPE "SaleCommissionSourceType" AS ENUM ('PULLED', 'MANUAL');

-- CreateEnum
CREATE TYPE "SaleCommissionRecipientType" AS ENUM ('COMPANY', 'UNIT', 'SELLER', 'PARTNER', 'SUPERVISOR', 'OTHER');

-- CreateTable
CREATE TABLE "sale_commissions" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "source_type" "SaleCommissionSourceType" NOT NULL,
    "recipient_type" "SaleCommissionRecipientType" NOT NULL,
    "beneficiary_company_id" TEXT,
    "beneficiary_unit_id" TEXT,
    "beneficiary_seller_id" TEXT,
    "beneficiary_partner_id" TEXT,
    "beneficiary_supervisor_id" TEXT,
    "beneficiary_label" TEXT,
    "total_percentage" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_commission_installments" (
    "id" TEXT NOT NULL,
    "sale_commission_id" TEXT NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_commission_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_commissions_sale_id_idx" ON "sale_commissions"("sale_id");

-- CreateIndex
CREATE INDEX "sale_commissions_sale_id_sort_order_idx" ON "sale_commissions"("sale_id", "sort_order");

-- CreateIndex
CREATE INDEX "sale_commissions_beneficiary_company_id_idx" ON "sale_commissions"("beneficiary_company_id");

-- CreateIndex
CREATE INDEX "sale_commissions_beneficiary_unit_id_idx" ON "sale_commissions"("beneficiary_unit_id");

-- CreateIndex
CREATE INDEX "sale_commissions_beneficiary_seller_id_idx" ON "sale_commissions"("beneficiary_seller_id");

-- CreateIndex
CREATE INDEX "sale_commissions_beneficiary_partner_id_idx" ON "sale_commissions"("beneficiary_partner_id");

-- CreateIndex
CREATE INDEX "sale_commissions_beneficiary_supervisor_id_idx" ON "sale_commissions"("beneficiary_supervisor_id");

-- CreateIndex
CREATE UNIQUE INDEX "sale_commission_installments_sale_commission_id_installment_num_key" ON "sale_commission_installments"("sale_commission_id", "installment_number");

-- CreateIndex
CREATE INDEX "sale_commission_installments_sale_commission_id_idx" ON "sale_commission_installments"("sale_commission_id");

-- AddForeignKey
ALTER TABLE "sale_commissions" ADD CONSTRAINT "sale_commissions_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_commissions" ADD CONSTRAINT "sale_commissions_beneficiary_company_id_fkey" FOREIGN KEY ("beneficiary_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_commissions" ADD CONSTRAINT "sale_commissions_beneficiary_unit_id_fkey" FOREIGN KEY ("beneficiary_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_commissions" ADD CONSTRAINT "sale_commissions_beneficiary_seller_id_fkey" FOREIGN KEY ("beneficiary_seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_commissions" ADD CONSTRAINT "sale_commissions_beneficiary_partner_id_fkey" FOREIGN KEY ("beneficiary_partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_commissions" ADD CONSTRAINT "sale_commissions_beneficiary_supervisor_id_fkey" FOREIGN KEY ("beneficiary_supervisor_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_commission_installments" ADD CONSTRAINT "sale_commission_installments_sale_commission_id_fkey" FOREIGN KEY ("sale_commission_id") REFERENCES "sale_commissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "sale_commissions"
  ADD CONSTRAINT "sale_commissions_total_percentage_gt_zero_check"
  CHECK ("total_percentage" > 0);

-- AddCheckConstraint
ALTER TABLE "sale_commission_installments"
  ADD CONSTRAINT "sale_commission_installments_percentage_nonnegative_check"
  CHECK ("percentage" >= 0);
