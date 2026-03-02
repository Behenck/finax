DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'SALE_HAS_COMPANY'
      AND enumtypid = 'ProductCommissionScenarioConditionType'::regtype
  ) THEN
    ALTER TYPE "ProductCommissionScenarioConditionType" ADD VALUE 'SALE_HAS_COMPANY';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'SALE_HAS_PARTNER'
      AND enumtypid = 'ProductCommissionScenarioConditionType'::regtype
  ) THEN
    ALTER TYPE "ProductCommissionScenarioConditionType" ADD VALUE 'SALE_HAS_PARTNER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'SALE_HAS_UNIT'
      AND enumtypid = 'ProductCommissionScenarioConditionType'::regtype
  ) THEN
    ALTER TYPE "ProductCommissionScenarioConditionType" ADD VALUE 'SALE_HAS_UNIT';
  END IF;
END $$;

ALTER TABLE "product_commission_scenario_conditions"
DROP CONSTRAINT IF EXISTS "product_commission_scenario_conditions_type_check";

ALTER TABLE "product_commission_scenario_conditions"
ADD CONSTRAINT "product_commission_scenario_conditions_type_check"
CHECK (
  (
    type = 'SALE_HAS_COMPANY'::"ProductCommissionScenarioConditionType"
    AND seller_id IS NULL
    AND unit_id IS NULL
    AND company_id IS NULL
    AND partner_id IS NULL
  )
  OR (
    type = 'SALE_HAS_PARTNER'::"ProductCommissionScenarioConditionType"
    AND seller_id IS NULL
    AND unit_id IS NULL
    AND company_id IS NULL
    AND partner_id IS NULL
  )
  OR (
    type = 'SALE_HAS_SELLER'::"ProductCommissionScenarioConditionType"
    AND seller_id IS NULL
    AND unit_id IS NULL
    AND company_id IS NULL
    AND partner_id IS NULL
  )
  OR (
    type = 'SALE_HAS_UNIT'::"ProductCommissionScenarioConditionType"
    AND seller_id IS NULL
    AND unit_id IS NULL
    AND company_id IS NULL
    AND partner_id IS NULL
  )
  OR (
    type = 'SALE_UNIT_EQUALS'::"ProductCommissionScenarioConditionType"
    AND seller_id IS NULL
    AND unit_id IS NOT NULL
    AND company_id IS NULL
    AND partner_id IS NULL
  )
  OR (
    type = 'SELLER_EQUALS'::"ProductCommissionScenarioConditionType"
    AND seller_id IS NOT NULL
    AND unit_id IS NULL
    AND company_id IS NULL
    AND partner_id IS NULL
  )
  OR (
    type = 'COMPANY_EQUALS'::"ProductCommissionScenarioConditionType"
    AND seller_id IS NULL
    AND unit_id IS NULL
    AND company_id IS NOT NULL
    AND partner_id IS NULL
  )
  OR (
    type = 'PARTNER_EQUALS'::"ProductCommissionScenarioConditionType"
    AND seller_id IS NULL
    AND unit_id IS NULL
    AND company_id IS NULL
    AND partner_id IS NOT NULL
  )
);
