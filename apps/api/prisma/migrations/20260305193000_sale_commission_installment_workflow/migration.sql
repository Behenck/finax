-- Create enum for installment workflow status
DO $$
BEGIN
  CREATE TYPE "SaleCommissionInstallmentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add start date per commission
ALTER TABLE "sale_commissions"
  ADD COLUMN IF NOT EXISTS "start_date" DATE;

UPDATE "sale_commissions" sc
SET "start_date" = s."sale_date"::date
FROM "sales" s
WHERE sc."sale_id" = s."id"
  AND sc."start_date" IS NULL;

ALTER TABLE "sale_commissions"
  ALTER COLUMN "start_date" SET NOT NULL;

-- Add installment operational fields
ALTER TABLE "sale_commission_installments"
  ADD COLUMN IF NOT EXISTS "status" "SaleCommissionInstallmentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "expected_payment_date" DATE,
  ADD COLUMN IF NOT EXISTS "payment_date" DATE;

-- Backfill expected payment date and status
UPDATE "sale_commission_installments" sci
SET
  "expected_payment_date" = (
    sc."start_date" + ((sci."installment_number" - 1) * INTERVAL '1 month')
  )::date,
  "status" = CASE
    WHEN s."status" = 'CANCELED' THEN 'CANCELED'::"SaleCommissionInstallmentStatus"
    ELSE 'PENDING'::"SaleCommissionInstallmentStatus"
  END,
  "payment_date" = CASE
    WHEN s."status" = 'CANCELED' THEN NULL
    ELSE sci."payment_date"
  END
FROM "sale_commissions" sc
JOIN "sales" s ON s."id" = sc."sale_id"
WHERE sci."sale_commission_id" = sc."id"
  AND (
    sci."expected_payment_date" IS NULL
    OR s."status" = 'CANCELED'
  );

ALTER TABLE "sale_commission_installments"
  ALTER COLUMN "expected_payment_date" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_commission_installments_payment_date_paid_check'
  ) THEN
    ALTER TABLE "sale_commission_installments"
      ADD CONSTRAINT "sale_commission_installments_payment_date_paid_check"
      CHECK ("payment_date" IS NULL OR "status" = 'PAID');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "sale_commission_installments_sale_commission_id_status_idx"
  ON "sale_commission_installments"("sale_commission_id", "status");

CREATE INDEX IF NOT EXISTS "sale_commission_installments_expected_payment_date_idx"
  ON "sale_commission_installments"("expected_payment_date");
