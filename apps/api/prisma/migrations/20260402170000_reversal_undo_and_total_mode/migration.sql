-- Product reversal scenario modes + installment reversal origin snapshot fields.

DO $$
BEGIN
  CREATE TYPE "ProductCommissionReversalMode" AS ENUM (
    'INSTALLMENT_BY_NUMBER',
    'TOTAL_PAID_PERCENTAGE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "commission_reversal_mode" "ProductCommissionReversalMode",
  ADD COLUMN IF NOT EXISTS "commission_reversal_total_percentage" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_commission_reversal_total_percentage_check'
  ) THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_commission_reversal_total_percentage_check"
      CHECK (
        "commission_reversal_total_percentage" IS NULL OR
        (
          "commission_reversal_total_percentage" > 0
          AND "commission_reversal_total_percentage" <= 1000000
        )
      );
  END IF;
END $$;

-- Backfill existing products that already have per-installment rules.
UPDATE "products" p
SET "commission_reversal_mode" = 'INSTALLMENT_BY_NUMBER'
WHERE p."commission_reversal_mode" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "product_commission_reversal_rules" r
    WHERE r."product_id" = p."id"
  );

ALTER TABLE "sale_commission_installments"
  ADD COLUMN IF NOT EXISTS "reversed_from_status" "SaleCommissionInstallmentStatus",
  ADD COLUMN IF NOT EXISTS "reversed_from_amount" INTEGER,
  ADD COLUMN IF NOT EXISTS "reversed_from_payment_date" DATE;
