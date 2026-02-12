-- CreateEnum
CREATE TYPE "CustomerPersonType" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "CustomerDocumentType" AS ENUM ('CPF', 'CNPJ', 'RG', 'IE', 'PASSPORT', 'OTHER');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "person_type" "CustomerPersonType" NOT NULL,
    "name" TEXT NOT NULL,
    "document_type" "CustomerDocumentType" NOT NULL,
    "document_number" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_pf" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "birth_date" TIMESTAMP(3),
    "mother_name" TEXT,
    "father_name" TEXT,
    "monthly_income" INTEGER,
    "place_of_birth" TEXT,
    "profession" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_pf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_pj" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "trade_name" TEXT,
    "legal_name" TEXT,
    "state_registration" TEXT,
    "municipal_registration" TEXT,
    "foundation_date" TIMESTAMP(3),
    "business_activity" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_pj_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_organization_id_idx" ON "customers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_organization_id_document_type_document_number_key" ON "customers"("organization_id", "document_type", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "customer_pf_customer_id_key" ON "customer_pf"("customer_id");

-- CreateIndex
CREATE INDEX "customer_pf_organization_id_idx" ON "customer_pf"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_pj_customer_id_key" ON "customer_pj"("customer_id");

-- CreateIndex
CREATE INDEX "customer_pj_organization_id_idx" ON "customer_pj"("organization_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_pf" ADD CONSTRAINT "customer_pf_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_pj" ADD CONSTRAINT "customer_pj_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
