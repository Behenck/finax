-- Remove any legacy unique constraint/index on (sale_commission_id, installment_number)
-- to allow multiple reversal movements linked to the same base installment number.

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT c.conname
    FROM pg_constraint c
    INNER JOIN pg_class t ON t.oid = c.conrelid
    INNER JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'sale_commission_installments'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE 'UNIQUE (sale_commission_id, installment_number)%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.sale_commission_installments DROP CONSTRAINT IF EXISTS %I',
      constraint_record.conname
    );
  END LOOP;
END $$;

DO $$
DECLARE
  index_record RECORD;
BEGIN
  FOR index_record IN
    SELECT idx.indexname
    FROM pg_indexes idx
    WHERE idx.schemaname = 'public'
      AND idx.tablename = 'sale_commission_installments'
      AND idx.indexdef ILIKE 'CREATE UNIQUE INDEX%'
      AND idx.indexdef ILIKE '%(sale_commission_id, installment_number)%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', index_record.indexname);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS "sale_commission_installments_sale_commission_id_installment_number_idx"
  ON "sale_commission_installments" ("sale_commission_id", "installment_number");
