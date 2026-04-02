-- Allow negative amounts only for reversed installments.
-- Keep non-reversed installments non-negative.

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

-- Normalize legacy data before applying the stricter check.
UPDATE "sale_commission_installments"
SET "amount" = -ABS("amount")
WHERE "status"::text = 'REVERSED' AND "amount" > 0;

UPDATE "sale_commission_installments"
SET "amount" = ABS("amount")
WHERE "status"::text <> 'REVERSED' AND "amount" < 0;

DO $$
BEGIN
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
END $$;
