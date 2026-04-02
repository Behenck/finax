-- Add new installment status for reversals
DO $$
BEGIN
  ALTER TYPE "SaleCommissionInstallmentStatus" ADD VALUE IF NOT EXISTS 'REVERSED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Keep payment date valid for paid and reversed installments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_commission_installments_payment_date_paid_check'
  ) THEN
    ALTER TABLE "sale_commission_installments"
      DROP CONSTRAINT "sale_commission_installments_payment_date_paid_check";
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE "sale_commission_installments"
    ADD CONSTRAINT "sale_commission_installments_payment_date_paid_check"
    CHECK (
      "payment_date" IS NULL OR
      "status"::text IN ('PAID', 'REVERSED')
    );
END $$;

-- Product-level reversal rules by installment number
CREATE TABLE IF NOT EXISTS "product_commission_reversal_rules" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "installment_number" INTEGER NOT NULL,
  "percentage" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_commission_reversal_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_commission_reversal_rules_product_id_installment_number_key"
ON "product_commission_reversal_rules"("product_id", "installment_number");

CREATE INDEX IF NOT EXISTS "product_commission_reversal_rules_product_id_idx"
ON "product_commission_reversal_rules"("product_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_commission_reversal_rules_installment_number_check'
  ) THEN
    ALTER TABLE "product_commission_reversal_rules"
      ADD CONSTRAINT "product_commission_reversal_rules_installment_number_check"
      CHECK ("installment_number" >= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_commission_reversal_rules_percentage_check'
  ) THEN
    ALTER TABLE "product_commission_reversal_rules"
      ADD CONSTRAINT "product_commission_reversal_rules_percentage_check"
      CHECK ("percentage" > 0 AND "percentage" <= 1000000);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_commission_reversal_rules_product_id_fkey'
  ) THEN
    ALTER TABLE "product_commission_reversal_rules"
      ADD CONSTRAINT "product_commission_reversal_rules_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
