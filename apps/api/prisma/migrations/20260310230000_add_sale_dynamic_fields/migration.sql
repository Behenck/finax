-- CreateEnum
CREATE TYPE "SaleDynamicFieldType" AS ENUM (
  'TEXT',
  'NUMBER',
  'CURRENCY',
  'RICH_TEXT',
  'PHONE',
  'SELECT',
  'MULTI_SELECT',
  'DATE',
  'DATE_TIME'
);

-- CreateTable
CREATE TABLE "product_sale_fields" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "label_normalized" TEXT NOT NULL,
  "type" "SaleDynamicFieldType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_sale_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_sale_field_options" (
  "id" TEXT NOT NULL,
  "field_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "label_normalized" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_sale_field_options_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "sales"
ADD COLUMN "dynamic_field_schema" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "dynamic_field_values" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- CreateIndex
CREATE UNIQUE INDEX "product_sale_fields_product_id_label_normalized_key"
ON "product_sale_fields"("product_id", "label_normalized");

-- CreateIndex
CREATE INDEX "product_sale_fields_product_id_idx"
ON "product_sale_fields"("product_id");

-- CreateIndex
CREATE INDEX "product_sale_fields_product_id_sort_order_idx"
ON "product_sale_fields"("product_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "product_sale_field_options_field_id_label_normalized_key"
ON "product_sale_field_options"("field_id", "label_normalized");

-- CreateIndex
CREATE INDEX "product_sale_field_options_field_id_idx"
ON "product_sale_field_options"("field_id");

-- CreateIndex
CREATE INDEX "product_sale_field_options_field_id_sort_order_idx"
ON "product_sale_field_options"("field_id", "sort_order");

-- AddForeignKey
ALTER TABLE "product_sale_fields"
ADD CONSTRAINT "product_sale_fields_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sale_field_options"
ADD CONSTRAINT "product_sale_field_options_field_id_fkey"
FOREIGN KEY ("field_id") REFERENCES "product_sale_fields"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
