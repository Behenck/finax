-- Add column for monetary amount in cents per commission installment
ALTER TABLE "sale_commission_installments"
  ADD COLUMN "amount" INTEGER;

-- Backfill existing records using sale total amount and installment percentage.
-- Formula (in cents): amount = sale_total_amount * installment_percentage / (100 * 10_000)
-- Rounded strategy: floor for all installments and residual on last installment.
WITH installment_base AS (
  SELECT
    sci.id,
    sci.sale_commission_id,
    sci.installment_number,
    s.total_amount,
    sc.total_percentage,
    sci.percentage,
    FLOOR(
      (s.total_amount::numeric * sci.percentage::numeric) / 1000000
    )::INTEGER AS base_amount,
    ROW_NUMBER() OVER (
      PARTITION BY sci.sale_commission_id
      ORDER BY sci.installment_number DESC
    ) AS reverse_position
  FROM "sale_commission_installments" sci
  JOIN "sale_commissions" sc ON sc.id = sci.sale_commission_id
  JOIN "sales" s ON s.id = sc.sale_id
),
commission_totals AS (
  SELECT
    sale_commission_id,
    SUM(base_amount)::INTEGER AS base_sum,
    ROUND(
      (MAX(total_amount)::numeric * MAX(total_percentage)::numeric) / 1000000
    )::INTEGER AS rounded_total
  FROM installment_base
  GROUP BY sale_commission_id
)
UPDATE "sale_commission_installments" sci
SET "amount" = CASE
  WHEN ib.reverse_position = 1
    THEN ib.base_amount + (ct.rounded_total - ct.base_sum)
  ELSE ib.base_amount
END
FROM installment_base ib
JOIN commission_totals ct
  ON ct.sale_commission_id = ib.sale_commission_id
WHERE sci.id = ib.id;

ALTER TABLE "sale_commission_installments"
  ALTER COLUMN "amount" SET NOT NULL;

ALTER TABLE "sale_commission_installments"
  ADD CONSTRAINT "sale_commission_installments_amount_nonnegative_check"
  CHECK ("amount" >= 0);
