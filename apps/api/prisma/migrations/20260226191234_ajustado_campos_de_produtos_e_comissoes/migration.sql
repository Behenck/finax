-- Legacy hotfix migration.
-- This migration used to run before product commission tables were created in this repo history.
-- Keep it defensive so the migration chain can run both on old and fresh databases.

DO $$
BEGIN
	IF to_regclass('public.product_commission_scenario_conditions') IS NOT NULL THEN
		ALTER TABLE "product_commission_scenario_conditions"
		DROP CONSTRAINT IF EXISTS "product_commission_scenario_conditions_seller_id_fkey";

		ALTER TABLE "product_commission_scenario_conditions"
		DROP CONSTRAINT IF EXISTS "product_commission_scenario_conditions_unit_id_fkey";
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
	END IF;
END $$;

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
	END IF;
END $$;

DO $$
BEGIN
	IF to_regclass('public.product_commission_scenario_conditions') IS NOT NULL THEN
		IF NOT EXISTS (
			SELECT 1
			FROM pg_constraint
			WHERE conname = 'product_commission_scenario_conditions_seller_id_fkey'
		) THEN
			ALTER TABLE "product_commission_scenario_conditions"
			ADD CONSTRAINT "product_commission_scenario_conditions_seller_id_fkey"
			FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
			ON DELETE SET NULL ON UPDATE CASCADE;
		END IF;

		IF NOT EXISTS (
			SELECT 1
			FROM pg_constraint
			WHERE conname = 'product_commission_scenario_conditions_unit_id_fkey'
		) THEN
			ALTER TABLE "product_commission_scenario_conditions"
			ADD CONSTRAINT "product_commission_scenario_conditions_unit_id_fkey"
			FOREIGN KEY ("unit_id") REFERENCES "units"("id")
			ON DELETE SET NULL ON UPDATE CASCADE;
		END IF;
	END IF;
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
END $$;
