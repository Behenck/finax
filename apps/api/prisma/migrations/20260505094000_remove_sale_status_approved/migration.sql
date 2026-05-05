ALTER TYPE "SaleStatus" RENAME TO "SaleStatus_old";

CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELED');

ALTER TABLE "sales"
ALTER COLUMN "status" DROP DEFAULT;

UPDATE "sales"
SET "status" = 'COMPLETED'
WHERE "status" = 'APPROVED';

ALTER TABLE "sales"
ALTER COLUMN "status" TYPE "SaleStatus"
USING ("status"::text::"SaleStatus");

ALTER TABLE "sales"
ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP TYPE "SaleStatus_old";
