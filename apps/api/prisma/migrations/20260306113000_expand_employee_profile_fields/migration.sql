-- CreateEnum
CREATE TYPE "EmployeePixKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');

-- AlterTable
ALTER TABLE "employees"
ADD COLUMN "cpf" TEXT,
ADD COLUMN "pix_key_type" "EmployeePixKeyType",
ADD COLUMN "pix_key" TEXT,
ADD COLUMN "payment_notes" TEXT,
ADD COLUMN "street" TEXT,
ADD COLUMN "number" TEXT,
ADD COLUMN "complement" TEXT,
ADD COLUMN "neighborhood" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "zip_code" TEXT,
ADD COLUMN "country" TEXT;
