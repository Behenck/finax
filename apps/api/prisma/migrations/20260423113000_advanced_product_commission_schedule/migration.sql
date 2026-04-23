ALTER TABLE "product_commissions"
  ADD COLUMN "use_advanced_date_schedule" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "product_commission_installments"
  ADD COLUMN "months_to_advance" INTEGER NOT NULL DEFAULT 1;

WITH ordered_installments AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY commission_id
      ORDER BY installment_number ASC
    ) AS position
  FROM "product_commission_installments"
)
UPDATE "product_commission_installments" pci
SET "months_to_advance" = CASE
  WHEN ordered_installments.position = 1 THEN 0
  ELSE 1
END
FROM ordered_installments
WHERE ordered_installments.id = pci.id;

ALTER TABLE "product_commission_installments"
  ADD CONSTRAINT "product_commission_installments_months_to_advance_check"
  CHECK ("months_to_advance" >= 0);

ALTER TABLE "sale_commissions"
  ADD COLUMN "use_advanced_date_schedule" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "sale_commission_installments"
  ADD COLUMN "months_to_advance" INTEGER NOT NULL DEFAULT 1;

WITH ordered_sale_installments AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY sale_commission_id
      ORDER BY installment_number ASC
    ) AS position
  FROM "sale_commission_installments"
)
UPDATE "sale_commission_installments" sci
SET "months_to_advance" = CASE
  WHEN ordered_sale_installments.position = 1 THEN 0
  ELSE 1
END
FROM ordered_sale_installments
WHERE ordered_sale_installments.id = sci.id;

ALTER TABLE "sale_commission_installments"
  ADD CONSTRAINT "sale_commission_installments_months_to_advance_check"
  CHECK ("months_to_advance" >= 0);

ALTER TABLE "sale_commission_installments"
  ALTER COLUMN "expected_payment_date" DROP NOT NULL;
