DO $$
BEGIN
	IF to_regclass('public.product_commission_installments') IS NULL THEN
		RETURN;
	END IF;

	ALTER TABLE "product_commission_installments"
	DROP CONSTRAINT IF EXISTS "product_commission_installments_percentage_check";

	ALTER TABLE "product_commission_installments"
	DROP CONSTRAINT IF EXISTS "product_commission_installments_percentage_x100_check";

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
	ELSIF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'product_commission_installments'
			AND column_name = 'percentage_x100'
	) THEN
		ALTER TABLE "product_commission_installments"
		ADD CONSTRAINT "product_commission_installments_percentage_x100_check"
		CHECK (
			"percentage_x100" >= 0
			AND "percentage_x100" <= 10000000
		);
	END IF;
END $$;
