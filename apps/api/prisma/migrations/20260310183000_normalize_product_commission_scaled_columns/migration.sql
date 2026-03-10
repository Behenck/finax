-- Normalize legacy scaled percentage columns to the current schema columns.
-- This migration is idempotent and handles both old and already-migrated databases.

DO $$
BEGIN
	IF to_regclass('public.product_commissions') IS NOT NULL THEN
		IF EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'product_commissions'
				AND column_name = 'total_percentage_x100'
		) THEN
			IF NOT EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
					AND table_name = 'product_commissions'
					AND column_name = 'total_percentage'
			) THEN
				ALTER TABLE "product_commissions"
				ADD COLUMN "total_percentage" INTEGER;
			END IF;

			UPDATE "product_commissions"
			SET "total_percentage" = COALESCE("total_percentage", "total_percentage_x100");

			ALTER TABLE "product_commissions"
			ALTER COLUMN "total_percentage" SET NOT NULL;

			ALTER TABLE "product_commissions"
			DROP COLUMN "total_percentage_x100";
		END IF;

		ALTER TABLE "product_commissions"
		DROP CONSTRAINT IF EXISTS "product_commissions_total_percentage_x100_check";

		ALTER TABLE "product_commissions"
		DROP CONSTRAINT IF EXISTS "product_commissions_total_percentage_check";

		IF EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'product_commissions'
				AND column_name = 'total_percentage'
		) THEN
			ALTER TABLE "product_commissions"
			ADD CONSTRAINT "product_commissions_total_percentage_check"
			CHECK (
				"total_percentage" > 0
				AND "total_percentage" <= 10000000
			);
		END IF;
	END IF;
END $$;

DO $$
BEGIN
	IF to_regclass('public.product_commission_installments') IS NOT NULL THEN
		IF EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'product_commission_installments'
				AND column_name = 'percentage_x100'
		) THEN
			IF NOT EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
					AND table_name = 'product_commission_installments'
					AND column_name = 'percentage'
			) THEN
				ALTER TABLE "product_commission_installments"
				ADD COLUMN "percentage" INTEGER;
			END IF;

			UPDATE "product_commission_installments"
			SET "percentage" = COALESCE("percentage", "percentage_x100");

			ALTER TABLE "product_commission_installments"
			ALTER COLUMN "percentage" SET NOT NULL;

			ALTER TABLE "product_commission_installments"
			DROP COLUMN "percentage_x100";
		END IF;

		ALTER TABLE "product_commission_installments"
		DROP CONSTRAINT IF EXISTS "product_commission_installments_percentage_x100_check";

		ALTER TABLE "product_commission_installments"
		DROP CONSTRAINT IF EXISTS "product_commission_installments_percentage_check";

		IF EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'product_commission_installments'
				AND column_name = 'percentage'
		) THEN
			ALTER TABLE "product_commission_installments"
			ADD CONSTRAINT "product_commission_installments_percentage_check"
			CHECK (
				"percentage" >= 0
				AND "percentage" <= 10000000
			);
		END IF;
	END IF;
END $$;

DO $$
BEGIN
	IF to_regclass('public.product_commission_scenario_conditions') IS NULL THEN
		RETURN;
	END IF;

	ALTER TABLE "product_commission_scenario_conditions"
	DROP CONSTRAINT IF EXISTS "product_commission_scenario_conditions_seller_id_fkey";

	ALTER TABLE "product_commission_scenario_conditions"
	DROP CONSTRAINT IF EXISTS "product_commission_scenario_conditions_unit_id_fkey";

	ALTER TABLE "product_commission_scenario_conditions"
	ADD CONSTRAINT "product_commission_scenario_conditions_seller_id_fkey"
	FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
	ON DELETE SET NULL ON UPDATE CASCADE;

	ALTER TABLE "product_commission_scenario_conditions"
	ADD CONSTRAINT "product_commission_scenario_conditions_unit_id_fkey"
	FOREIGN KEY ("unit_id") REFERENCES "units"("id")
	ON DELETE SET NULL ON UPDATE CASCADE;

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
END $$;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_indexes
		WHERE schemaname = 'public'
			AND indexname = 'product_commission_installments_commission_id_installment_numbe'
	) THEN
		ALTER INDEX "product_commission_installments_commission_id_installment_numbe"
		RENAME TO "product_commission_installments_commission_id_installment_n_key";
	END IF;

	IF EXISTS (
		SELECT 1
		FROM pg_indexes
		WHERE schemaname = 'public'
			AND indexname = 'product_commission_scenario_conditions_scenario_id_sort_order_i'
	) THEN
		ALTER INDEX "product_commission_scenario_conditions_scenario_id_sort_order_i"
		RENAME TO "product_commission_scenario_conditions_scenario_id_sort_ord_idx";
	END IF;

	IF EXISTS (
		SELECT 1
		FROM pg_indexes
		WHERE schemaname = 'public'
			AND indexname = 'product_commission_scenarios_product_id_is_active_sort_order_id'
	) THEN
		ALTER INDEX "product_commission_scenarios_product_id_is_active_sort_order_id"
		RENAME TO "product_commission_scenarios_product_id_is_active_sort_orde_idx";
	END IF;

	IF EXISTS (
		SELECT 1
		FROM pg_indexes
		WHERE schemaname = 'public'
			AND indexname = 'sale_commission_installments_sale_commission_id_installment_num'
	) THEN
		ALTER INDEX "sale_commission_installments_sale_commission_id_installment_num"
		RENAME TO "sale_commission_installments_sale_commission_id_installment_key";
	END IF;
END $$;
