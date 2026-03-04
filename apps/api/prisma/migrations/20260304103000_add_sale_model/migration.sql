-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SaleResponsibleType" AS ENUM ('SELLER', 'PARTNER');

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "unit_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sale_date" DATE NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'PENDING',
    "responsible_type" "SaleResponsibleType" NOT NULL,
    "responsible_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_organization_id_sale_date_idx" ON "sales"("organization_id", "sale_date");

-- CreateIndex
CREATE INDEX "sales_organization_id_status_idx" ON "sales"("organization_id", "status");

-- CreateIndex
CREATE INDEX "sales_organization_id_company_id_idx" ON "sales"("organization_id", "company_id");

-- CreateIndex
CREATE INDEX "sales_company_id_unit_id_idx" ON "sales"("company_id", "unit_id");

-- CreateIndex
CREATE INDEX "sales_customer_id_idx" ON "sales"("customer_id");

-- CreateIndex
CREATE INDEX "sales_product_id_idx" ON "sales"("product_id");

-- CreateIndex
CREATE INDEX "sales_created_by_id_idx" ON "sales"("created_by_id");

-- CreateIndex
CREATE INDEX "sales_organization_id_responsible_type_responsible_id_idx" ON "sales"("organization_id", "responsible_type", "responsible_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "sales"
  ADD CONSTRAINT "sales_total_amount_gt_zero_check"
  CHECK ("total_amount" > 0);

-- AddCheckConstraint
ALTER TABLE "sales"
  ADD CONSTRAINT "sales_responsible_id_not_empty_check"
  CHECK (length(trim("responsible_id")) > 0);
