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
      "status"::text IN ('PAID', 'REVERSED', 'CANCELED')
    );
END $$;
