-- Add enum value for scenario condition type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'COMPANY_EQUALS'
      AND enumtypid = '"ProductCommissionScenarioConditionType"'::regtype
  ) THEN
    ALTER TYPE "ProductCommissionScenarioConditionType" ADD VALUE 'COMPANY_EQUALS';
  END IF;
END $$;

-- Add enum value for commission recipient type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'UNIT'
      AND enumtypid = '"ProductCommissionRecipientType"'::regtype
  ) THEN
    ALTER TYPE "ProductCommissionRecipientType" ADD VALUE 'UNIT';
  END IF;
END $$;

-- Add condition target company
ALTER TABLE "product_commission_scenario_conditions"
ADD COLUMN "company_id" TEXT;

-- Add recipient entity columns
ALTER TABLE "product_commissions"
ADD COLUMN "recipient_company_id" TEXT,
ADD COLUMN "recipient_unit_id" TEXT,
ADD COLUMN "recipient_seller_id" TEXT,
ADD COLUMN "recipient_supervisor_id" TEXT;

-- Add indexes
CREATE INDEX "product_commission_scenario_conditions_company_id_idx"
ON "product_commission_scenario_conditions"("company_id");

CREATE INDEX "product_commissions_recipient_company_id_idx"
ON "product_commissions"("recipient_company_id");

CREATE INDEX "product_commissions_recipient_unit_id_idx"
ON "product_commissions"("recipient_unit_id");

CREATE INDEX "product_commissions_recipient_seller_id_idx"
ON "product_commissions"("recipient_seller_id");

CREATE INDEX "product_commissions_recipient_supervisor_id_idx"
ON "product_commissions"("recipient_supervisor_id");

-- Add foreign keys
ALTER TABLE "product_commission_scenario_conditions"
ADD CONSTRAINT "product_commission_scenario_conditions_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "product_commissions"
ADD CONSTRAINT "product_commissions_recipient_company_id_fkey"
FOREIGN KEY ("recipient_company_id") REFERENCES "companies"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "product_commissions"
ADD CONSTRAINT "product_commissions_recipient_unit_id_fkey"
FOREIGN KEY ("recipient_unit_id") REFERENCES "units"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "product_commissions"
ADD CONSTRAINT "product_commissions_recipient_seller_id_fkey"
FOREIGN KEY ("recipient_seller_id") REFERENCES "sellers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "product_commissions"
ADD CONSTRAINT "product_commissions_recipient_supervisor_id_fkey"
FOREIGN KEY ("recipient_supervisor_id") REFERENCES "members"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
