-- CreateTable
CREATE TABLE "sale_import_templates" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "header_signature" TEXT NOT NULL,
  "mapping_json" JSONB NOT NULL,
  "fixed_values_json" JSONB NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sale_import_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_import_audits" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "template_id" TEXT,
  "file_type" TEXT NOT NULL,
  "header_signature" TEXT NOT NULL,
  "total_rows" INTEGER NOT NULL,
  "imported_rows" INTEGER NOT NULL,
  "failed_rows" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sale_import_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sale_import_templates_organization_id_name_key"
ON "sale_import_templates"("organization_id", "name");

-- CreateIndex
CREATE INDEX "sale_import_templates_organization_id_idx"
ON "sale_import_templates"("organization_id");

-- CreateIndex
CREATE INDEX "sale_import_templates_organization_id_header_signature_idx"
ON "sale_import_templates"("organization_id", "header_signature");

-- CreateIndex
CREATE INDEX "sale_import_templates_created_by_id_idx"
ON "sale_import_templates"("created_by_id");

-- CreateIndex
CREATE INDEX "sale_import_audits_organization_id_idx"
ON "sale_import_audits"("organization_id");

-- CreateIndex
CREATE INDEX "sale_import_audits_organization_id_created_at_idx"
ON "sale_import_audits"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "sale_import_audits_actor_id_idx"
ON "sale_import_audits"("actor_id");

-- CreateIndex
CREATE INDEX "sale_import_audits_template_id_idx"
ON "sale_import_audits"("template_id");

-- AddForeignKey
ALTER TABLE "sale_import_templates"
ADD CONSTRAINT "sale_import_templates_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_import_templates"
ADD CONSTRAINT "sale_import_templates_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_import_audits"
ADD CONSTRAINT "sale_import_audits_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_import_audits"
ADD CONSTRAINT "sale_import_audits_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_import_audits"
ADD CONSTRAINT "sale_import_audits_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "sale_import_templates"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
