ALTER TABLE "product_commission_scenario_conditions"
DROP CONSTRAINT IF EXISTS "product_commission_scenario_conditions_type_check";

ALTER TABLE "product_commission_scenario_conditions"
ADD CONSTRAINT "product_commission_scenario_conditions_type_check"
CHECK (
  (
    type = 'SALE_HAS_SELLER'::"ProductCommissionScenarioConditionType"
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
