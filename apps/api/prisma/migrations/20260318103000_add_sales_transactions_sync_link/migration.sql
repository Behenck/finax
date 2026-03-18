-- AlterTable
ALTER TABLE "organizations"
ADD COLUMN "enable_sales_transactions_sync" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "products"
ADD COLUMN "sales_transaction_category_id" TEXT,
ADD COLUMN "sales_transaction_cost_center_id" TEXT;

-- AlterTable
ALTER TABLE "transactions"
ADD COLUMN "sale_id" TEXT;

-- CreateIndex
CREATE INDEX "products_sales_transaction_category_id_idx" ON "products"("sales_transaction_category_id");

-- CreateIndex
CREATE INDEX "products_sales_transaction_cost_center_id_idx" ON "products"("sales_transaction_cost_center_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_sale_id_key" ON "transactions"("sale_id");

-- AddForeignKey
ALTER TABLE "products"
ADD CONSTRAINT "products_sales_transaction_category_id_fkey"
FOREIGN KEY ("sales_transaction_category_id") REFERENCES "categories"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products"
ADD CONSTRAINT "products_sales_transaction_cost_center_id_fkey"
FOREIGN KEY ("sales_transaction_cost_center_id") REFERENCES "cost_centers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_sale_id_fkey"
FOREIGN KEY ("sale_id") REFERENCES "sales"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
