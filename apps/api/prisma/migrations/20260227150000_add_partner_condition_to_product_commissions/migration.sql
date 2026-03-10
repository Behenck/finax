-- Add enum value for partner condition type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'PARTNER_EQUALS'
      AND enumtypid = '"ProductCommissionScenarioConditionType"'::regtype
  ) THEN
    ALTER TYPE "ProductCommissionScenarioConditionType" ADD VALUE 'PARTNER_EQUALS';
  END IF;
END $$;

-- Add partner condition target
ALTER TABLE "product_commission_scenario_conditions"
ADD COLUMN "partner_id" TEXT;

-- Add index
CREATE INDEX "product_commission_scenario_conditions_partner_id_idx"
ON "product_commission_scenario_conditions"("partner_id");

-- Add foreign key
ALTER TABLE "product_commission_scenario_conditions"
ADD CONSTRAINT "product_commission_scenario_conditions_partner_id_fkey"
FOREIGN KEY ("partner_id") REFERENCES "partners"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
