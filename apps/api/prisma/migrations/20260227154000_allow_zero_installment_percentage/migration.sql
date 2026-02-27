ALTER TABLE "product_commission_installments"
DROP CONSTRAINT IF EXISTS "product_commission_installments_percentage_check";

ALTER TABLE "product_commission_installments"
ADD CONSTRAINT "product_commission_installments_percentage_check"
CHECK (
  percentage >= 0
  AND percentage <= 10000000
);
