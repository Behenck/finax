DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'SALE_HAS_COMPANY'
      AND enumtypid = '"ProductCommissionScenarioConditionType"'::regtype
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
      AND enumtypid = '"ProductCommissionScenarioConditionType"'::regtype
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
      AND enumtypid = '"ProductCommissionScenarioConditionType"'::regtype
  ) THEN
    ALTER TYPE "ProductCommissionScenarioConditionType" ADD VALUE 'SALE_HAS_UNIT';
  END IF;
END $$;

