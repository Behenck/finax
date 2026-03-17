-- AlterTable
ALTER TABLE "sales"
  ALTER COLUMN "responsible_type" DROP NOT NULL,
  ALTER COLUMN "responsible_id" DROP NOT NULL;
