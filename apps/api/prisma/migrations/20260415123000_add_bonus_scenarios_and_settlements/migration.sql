-- CreateEnum
CREATE TYPE "ProductBonusMetric" AS ENUM ('SALE_TOTAL');

-- CreateEnum
CREATE TYPE "ProductBonusPeriodFrequency" AS ENUM ('MONTHLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ProductBonusParticipantType" AS ENUM ('COMPANY', 'PARTNER', 'SELLER', 'SUPERVISOR');

-- AlterEnum
ALTER TYPE "SaleCommissionSourceType" ADD VALUE 'BONUS';

-- CreateTable
CREATE TABLE "product_bonus_scenarios" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metric" "ProductBonusMetric" NOT NULL DEFAULT 'SALE_TOTAL',
    "target_amount" INTEGER NOT NULL,
    "period_frequency" "ProductBonusPeriodFrequency" NOT NULL,
    "payout_enabled" BOOLEAN NOT NULL DEFAULT false,
    "payout_total_percentage" INTEGER,
    "payout_due_day" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_bonus_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_bonus_scenario_participants" (
    "id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "type" "ProductBonusParticipantType" NOT NULL,
    "company_id" TEXT,
    "partner_id" TEXT,
    "seller_id" TEXT,
    "supervisor_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_bonus_scenario_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_bonus_scenario_payout_installments" (
    "id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_bonus_scenario_payout_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonus_settlements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "period_frequency" "ProductBonusPeriodFrequency" NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_index" INTEGER NOT NULL,
    "settled_by_id" TEXT NOT NULL,
    "settled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "winners_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonus_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonus_settlement_results" (
    "id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "participant_type" "ProductBonusParticipantType" NOT NULL,
    "beneficiary_company_id" TEXT,
    "beneficiary_partner_id" TEXT,
    "beneficiary_seller_id" TEXT,
    "beneficiary_supervisor_id" TEXT,
    "beneficiary_label" TEXT NOT NULL,
    "achieved_amount" INTEGER NOT NULL,
    "target_amount" INTEGER NOT NULL,
    "payout_enabled" BOOLEAN NOT NULL DEFAULT false,
    "payout_amount" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonus_settlement_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonus_installments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "scenario_name" TEXT NOT NULL,
    "period_frequency" "ProductBonusPeriodFrequency" NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_index" INTEGER NOT NULL,
    "recipient_type" "SaleCommissionRecipientType" NOT NULL,
    "direction" "SaleCommissionDirection" NOT NULL DEFAULT 'OUTCOME',
    "beneficiary_company_id" TEXT,
    "beneficiary_partner_id" TEXT,
    "beneficiary_seller_id" TEXT,
    "beneficiary_supervisor_id" TEXT,
    "beneficiary_label" TEXT NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "SaleCommissionInstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "expected_payment_date" DATE NOT NULL,
    "payment_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonus_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_bonus_scenarios_product_id_idx" ON "product_bonus_scenarios"("product_id");

-- CreateIndex
CREATE INDEX "product_bonus_scenarios_product_id_is_active_sort_order_idx" ON "product_bonus_scenarios"("product_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "product_bonus_scenarios_product_id_name_key" ON "product_bonus_scenarios"("product_id", "name");

-- CreateIndex
CREATE INDEX "product_bonus_scenario_participants_scenario_id_idx" ON "product_bonus_scenario_participants"("scenario_id");

-- CreateIndex
CREATE INDEX "product_bonus_scenario_participants_scenario_id_sort_order_idx" ON "product_bonus_scenario_participants"("scenario_id", "sort_order");

-- CreateIndex
CREATE INDEX "product_bonus_scenario_participants_company_id_idx" ON "product_bonus_scenario_participants"("company_id");

-- CreateIndex
CREATE INDEX "product_bonus_scenario_participants_partner_id_idx" ON "product_bonus_scenario_participants"("partner_id");

-- CreateIndex
CREATE INDEX "product_bonus_scenario_participants_seller_id_idx" ON "product_bonus_scenario_participants"("seller_id");

-- CreateIndex
CREATE INDEX "product_bonus_scenario_participants_supervisor_id_idx" ON "product_bonus_scenario_participants"("supervisor_id");

-- CreateIndex
CREATE INDEX "product_bonus_scenario_payout_installments_scenario_id_idx" ON "product_bonus_scenario_payout_installments"("scenario_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_bonus_scenario_payout_installments_scenario_id_inst_key" ON "product_bonus_scenario_payout_installments"("scenario_id", "installment_number");

-- CreateIndex
CREATE INDEX "bonus_settlements_organization_id_product_id_idx" ON "bonus_settlements"("organization_id", "product_id");

-- CreateIndex
CREATE INDEX "bonus_settlements_organization_id_period_frequency_period_y_idx" ON "bonus_settlements"("organization_id", "period_frequency", "period_year", "period_index");

-- CreateIndex
CREATE UNIQUE INDEX "bonus_settlements_organization_id_product_id_period_frequen_key" ON "bonus_settlements"("organization_id", "product_id", "period_frequency", "period_year", "period_index");

-- CreateIndex
CREATE INDEX "bonus_settlement_results_settlement_id_idx" ON "bonus_settlement_results"("settlement_id");

-- CreateIndex
CREATE INDEX "bonus_settlement_results_scenario_id_idx" ON "bonus_settlement_results"("scenario_id");

-- CreateIndex
CREATE INDEX "bonus_settlement_results_beneficiary_company_id_idx" ON "bonus_settlement_results"("beneficiary_company_id");

-- CreateIndex
CREATE INDEX "bonus_settlement_results_beneficiary_partner_id_idx" ON "bonus_settlement_results"("beneficiary_partner_id");

-- CreateIndex
CREATE INDEX "bonus_settlement_results_beneficiary_seller_id_idx" ON "bonus_settlement_results"("beneficiary_seller_id");

-- CreateIndex
CREATE INDEX "bonus_settlement_results_beneficiary_supervisor_id_idx" ON "bonus_settlement_results"("beneficiary_supervisor_id");

-- CreateIndex
CREATE INDEX "bonus_installments_organization_id_status_idx" ON "bonus_installments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "bonus_installments_organization_id_expected_payment_date_idx" ON "bonus_installments"("organization_id", "expected_payment_date");

-- CreateIndex
CREATE INDEX "bonus_installments_product_id_idx" ON "bonus_installments"("product_id");

-- CreateIndex
CREATE INDEX "bonus_installments_settlement_id_idx" ON "bonus_installments"("settlement_id");

-- CreateIndex
CREATE INDEX "bonus_installments_result_id_idx" ON "bonus_installments"("result_id");

-- CreateIndex
CREATE INDEX "bonus_installments_scenario_id_idx" ON "bonus_installments"("scenario_id");

-- CreateIndex
CREATE INDEX "bonus_installments_beneficiary_company_id_idx" ON "bonus_installments"("beneficiary_company_id");

-- CreateIndex
CREATE INDEX "bonus_installments_beneficiary_partner_id_idx" ON "bonus_installments"("beneficiary_partner_id");

-- CreateIndex
CREATE INDEX "bonus_installments_beneficiary_seller_id_idx" ON "bonus_installments"("beneficiary_seller_id");

-- CreateIndex
CREATE INDEX "bonus_installments_beneficiary_supervisor_id_idx" ON "bonus_installments"("beneficiary_supervisor_id");

-- AddForeignKey
ALTER TABLE "product_bonus_scenarios" ADD CONSTRAINT "product_bonus_scenarios_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_bonus_scenario_participants" ADD CONSTRAINT "product_bonus_scenario_participants_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "product_bonus_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_bonus_scenario_participants" ADD CONSTRAINT "product_bonus_scenario_participants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_bonus_scenario_participants" ADD CONSTRAINT "product_bonus_scenario_participants_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_bonus_scenario_participants" ADD CONSTRAINT "product_bonus_scenario_participants_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_bonus_scenario_participants" ADD CONSTRAINT "product_bonus_scenario_participants_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_bonus_scenario_payout_installments" ADD CONSTRAINT "product_bonus_scenario_payout_installments_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "product_bonus_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_settlements" ADD CONSTRAINT "bonus_settlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_settlements" ADD CONSTRAINT "bonus_settlements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_settlements" ADD CONSTRAINT "bonus_settlements_settled_by_id_fkey" FOREIGN KEY ("settled_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_settlement_results" ADD CONSTRAINT "bonus_settlement_results_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "bonus_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_settlement_results" ADD CONSTRAINT "bonus_settlement_results_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "product_bonus_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_settlement_results" ADD CONSTRAINT "bonus_settlement_results_beneficiary_company_id_fkey" FOREIGN KEY ("beneficiary_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_settlement_results" ADD CONSTRAINT "bonus_settlement_results_beneficiary_partner_id_fkey" FOREIGN KEY ("beneficiary_partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_settlement_results" ADD CONSTRAINT "bonus_settlement_results_beneficiary_seller_id_fkey" FOREIGN KEY ("beneficiary_seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_settlement_results" ADD CONSTRAINT "bonus_settlement_results_beneficiary_supervisor_id_fkey" FOREIGN KEY ("beneficiary_supervisor_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_installments" ADD CONSTRAINT "bonus_installments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_installments" ADD CONSTRAINT "bonus_installments_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "bonus_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_installments" ADD CONSTRAINT "bonus_installments_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "bonus_settlement_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_installments" ADD CONSTRAINT "bonus_installments_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "product_bonus_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_installments" ADD CONSTRAINT "bonus_installments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_installments" ADD CONSTRAINT "bonus_installments_beneficiary_company_id_fkey" FOREIGN KEY ("beneficiary_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_installments" ADD CONSTRAINT "bonus_installments_beneficiary_partner_id_fkey" FOREIGN KEY ("beneficiary_partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_installments" ADD CONSTRAINT "bonus_installments_beneficiary_seller_id_fkey" FOREIGN KEY ("beneficiary_seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_installments" ADD CONSTRAINT "bonus_installments_beneficiary_supervisor_id_fkey" FOREIGN KEY ("beneficiary_supervisor_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

