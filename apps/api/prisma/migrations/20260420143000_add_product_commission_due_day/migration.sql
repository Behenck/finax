ALTER TABLE "product_commissions"
ADD COLUMN "due_day" INTEGER;

ALTER TABLE "product_commissions"
ADD CONSTRAINT "product_commissions_due_day_check"
CHECK ("due_day" IS NULL OR ("due_day" >= 1 AND "due_day" <= 31));
