-- Estorno Parcial 3.0: keep base installment intact and create linked reversal movements.

ALTER TABLE "sale_commission_installments"
  ADD COLUMN IF NOT EXISTS "origin_installment_id" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sale_commission_installments'
      AND column_name = 'origin_installment_id'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE "sale_commission_installments"
      ALTER COLUMN "origin_installment_id" TYPE TEXT USING "origin_installment_id"::text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_commission_installments_origin_installment_id_fkey'
  ) THEN
    ALTER TABLE "sale_commission_installments"
      ADD CONSTRAINT "sale_commission_installments_origin_installment_id_fkey"
      FOREIGN KEY ("origin_installment_id")
      REFERENCES "sale_commission_installments" ("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_commission_installments_sale_commission_id_installment_number_key'
  ) THEN
    ALTER TABLE "sale_commission_installments"
      DROP CONSTRAINT "sale_commission_installments_sale_commission_id_installment_number_key";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "sale_commission_installments_origin_installment_id_idx"
  ON "sale_commission_installments" ("origin_installment_id");

CREATE INDEX IF NOT EXISTS "sale_commission_installments_sale_commission_id_installment_number_idx"
  ON "sale_commission_installments" ("sale_commission_id", "installment_number");

-- Enforce signed amount rule regardless of previous stale constraint definitions.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_commission_installments_amount_nonnegative_check'
  ) THEN
    ALTER TABLE "sale_commission_installments"
      DROP CONSTRAINT "sale_commission_installments_amount_nonnegative_check";
  END IF;
END $$;

ALTER TABLE "sale_commission_installments"
  ADD CONSTRAINT "sale_commission_installments_amount_nonnegative_check"
  CHECK (
    (
      "status"::text = 'REVERSED'
      AND "amount" < 0
    )
    OR (
      "status"::text <> 'REVERSED'
      AND "amount" >= 0
    )
  );
