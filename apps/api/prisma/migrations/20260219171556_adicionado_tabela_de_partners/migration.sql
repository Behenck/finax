-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PartnerDocumentType" AS ENUM ('CPF', 'CNPJ');

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "documentType" "PartnerDocumentType",
    "document" TEXT,
    "company_name" TEXT NOT NULL,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT NOT NULL,
    "zipCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BR',
    "user_id" TEXT,
    "supervisor_id" TEXT,
    "status" "PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partners_organization_id_idx" ON "partners"("organization_id");

-- CreateIndex
CREATE INDEX "partners_organization_id_status_idx" ON "partners"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "partners_organization_id_email_key" ON "partners"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "partners_organization_id_document_key" ON "partners"("organization_id", "document");

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
