-- CreateEnum
CREATE TYPE "ProductCommissionScenarioConditionType" AS ENUM (
    'SALE_HAS_SELLER',
    'SALE_UNIT_EQUALS',
    'SELLER_EQUALS'
);

-- CreateEnum
CREATE TYPE "ProductCommissionRecipientType" AS ENUM (
    'COMPANY',
    'SELLER',
    'PARTNER',
    'SUPERVISOR',
    'OTHER'
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_commission_scenarios" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_commission_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_commission_scenario_conditions" (
    "id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "type" "ProductCommissionScenarioConditionType" NOT NULL,
    "seller_id" TEXT,
    "unit_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_commission_scenario_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_commissions" (
    "id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recipient_type" "ProductCommissionRecipientType" NOT NULL,
    "recipient_other_description" TEXT,
    "total_percentage_x100" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_commission_installments" (
    "id" TEXT NOT NULL,
    "commission_id" TEXT NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "percentage_x100" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_commission_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_parent_id_name_key"
ON "products"("organization_id", "parent_id", "name");

-- CreateIndex
CREATE INDEX "products_organization_id_idx" ON "products"("organization_id");

-- CreateIndex
CREATE INDEX "products_parent_id_idx" ON "products"("parent_id");

-- CreateIndex
CREATE INDEX "products_organization_id_is_active_idx"
ON "products"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "product_commission_scenarios_product_id_name_key"
ON "product_commission_scenarios"("product_id", "name");

-- CreateIndex
CREATE INDEX "product_commission_scenarios_product_id_idx"
ON "product_commission_scenarios"("product_id");

-- CreateIndex
CREATE INDEX "product_commission_scenarios_product_id_is_active_sort_order_idx"
ON "product_commission_scenarios"("product_id", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "product_commission_scenario_conditions_scenario_id_idx"
ON "product_commission_scenario_conditions"("scenario_id");

-- CreateIndex
CREATE INDEX "product_commission_scenario_conditions_scenario_id_sort_order_idx"
ON "product_commission_scenario_conditions"("scenario_id", "sort_order");

-- CreateIndex
CREATE INDEX "product_commission_scenario_conditions_seller_id_idx"
ON "product_commission_scenario_conditions"("seller_id");

-- CreateIndex
CREATE INDEX "product_commission_scenario_conditions_unit_id_idx"
ON "product_commission_scenario_conditions"("unit_id");

-- CreateIndex
CREATE INDEX "product_commissions_scenario_id_idx"
ON "product_commissions"("scenario_id");

-- CreateIndex
CREATE INDEX "product_commissions_scenario_id_sort_order_idx"
ON "product_commissions"("scenario_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "product_commission_installments_commission_id_installment_number_key"
ON "product_commission_installments"("commission_id", "installment_number");

-- CreateIndex
CREATE INDEX "product_commission_installments_commission_id_idx"
ON "product_commission_installments"("commission_id");

-- AddForeignKey
ALTER TABLE "products"
ADD CONSTRAINT "products_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products"
ADD CONSTRAINT "products_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_commission_scenarios"
ADD CONSTRAINT "product_commission_scenarios_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_commission_scenario_conditions"
ADD CONSTRAINT "product_commission_scenario_conditions_scenario_id_fkey"
FOREIGN KEY ("scenario_id") REFERENCES "product_commission_scenarios"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_commission_scenario_conditions"
ADD CONSTRAINT "product_commission_scenario_conditions_seller_id_fkey"
FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_commission_scenario_conditions"
ADD CONSTRAINT "product_commission_scenario_conditions_unit_id_fkey"
FOREIGN KEY ("unit_id") REFERENCES "units"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_commissions"
ADD CONSTRAINT "product_commissions_scenario_id_fkey"
FOREIGN KEY ("scenario_id") REFERENCES "product_commission_scenarios"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_commission_installments"
ADD CONSTRAINT "product_commission_installments_commission_id_fkey"
FOREIGN KEY ("commission_id") REFERENCES "product_commissions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual partial unique index: at most one default scenario per product
CREATE UNIQUE INDEX "product_commission_scenarios_product_id_default_key"
ON "product_commission_scenarios"("product_id")
WHERE "is_default" = true;

-- Manual partial unique index: root products (parent_id IS NULL) must also have unique names per organization
CREATE UNIQUE INDEX "products_organization_id_root_name_key"
ON "products"("organization_id", "name")
WHERE "parent_id" IS NULL;

-- Manual checks: commission percentage bounds and OTHER recipient description
ALTER TABLE "product_commissions"
ADD CONSTRAINT "product_commissions_total_percentage_x100_check"
CHECK ("total_percentage_x100" > 0 AND "total_percentage_x100" <= 10000);

ALTER TABLE "product_commissions"
ADD CONSTRAINT "product_commissions_recipient_other_description_check"
CHECK (
  "recipient_type" <> 'OTHER'::"ProductCommissionRecipientType"
  OR (
    "recipient_other_description" IS NOT NULL
    AND btrim("recipient_other_description") <> ''
  )
);

-- Manual checks: installment bounds and percentage bounds
ALTER TABLE "product_commission_installments"
ADD CONSTRAINT "product_commission_installments_installment_number_check"
CHECK ("installment_number" >= 1);

ALTER TABLE "product_commission_installments"
ADD CONSTRAINT "product_commission_installments_percentage_x100_check"
CHECK ("percentage_x100" > 0 AND "percentage_x100" <= 10000);
