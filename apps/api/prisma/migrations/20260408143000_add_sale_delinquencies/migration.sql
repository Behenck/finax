DO $$
BEGIN
  ALTER TYPE "SaleHistoryAction" ADD VALUE IF NOT EXISTS 'DELINQUENCY_CREATED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "SaleHistoryAction" ADD VALUE IF NOT EXISTS 'DELINQUENCY_RESOLVED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "sale_delinquencies" (
  "id" TEXT NOT NULL,
  "sale_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "due_date" DATE NOT NULL,
  "resolved_at" TIMESTAMP(3),
  "created_by_id" TEXT NOT NULL,
  "resolved_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sale_delinquencies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sale_delinquencies_sale_id_idx"
  ON "sale_delinquencies"("sale_id");

CREATE INDEX IF NOT EXISTS "sale_delinquencies_organization_id_sale_id_idx"
  ON "sale_delinquencies"("organization_id", "sale_id");

CREATE INDEX IF NOT EXISTS "sale_delinquencies_organization_id_resolved_at_idx"
  ON "sale_delinquencies"("organization_id", "resolved_at");

CREATE INDEX IF NOT EXISTS "sale_delinquencies_sale_id_resolved_at_due_date_idx"
  ON "sale_delinquencies"("sale_id", "resolved_at", "due_date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_delinquencies_sale_id_fkey'
  ) THEN
    ALTER TABLE "sale_delinquencies"
      ADD CONSTRAINT "sale_delinquencies_sale_id_fkey"
      FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_delinquencies_organization_id_fkey'
  ) THEN
    ALTER TABLE "sale_delinquencies"
      ADD CONSTRAINT "sale_delinquencies_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_delinquencies_created_by_id_fkey'
  ) THEN
    ALTER TABLE "sale_delinquencies"
      ADD CONSTRAINT "sale_delinquencies_created_by_id_fkey"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_delinquencies_resolved_by_id_fkey'
  ) THEN
    ALTER TABLE "sale_delinquencies"
      ADD CONSTRAINT "sale_delinquencies_resolved_by_id_fkey"
      FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
