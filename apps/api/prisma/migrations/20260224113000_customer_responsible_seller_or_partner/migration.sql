-- CreateEnum
CREATE TYPE "CustomerResponsibleType" AS ENUM ('SELLER', 'PARTNER');

-- AlterTable
ALTER TABLE "customers"
  ADD COLUMN "responsible_type" "CustomerResponsibleType",
  ADD COLUMN "responsible_id" TEXT;

-- CreateIndex
CREATE INDEX "customers_responsible_id_idx" ON "customers"("responsible_id");

-- AddCheckConstraint
ALTER TABLE "customers"
  ADD CONSTRAINT "customers_responsible_xor_check"
  CHECK (
    (
      "responsible_type" IS NULL
      AND "responsible_id" IS NULL
    )
    OR (
      "responsible_type" = 'SELLER'
      AND "responsible_id" IS NOT NULL
    )
    OR (
      "responsible_type" = 'PARTNER'
      AND "responsible_id" IS NOT NULL
    )
  );
