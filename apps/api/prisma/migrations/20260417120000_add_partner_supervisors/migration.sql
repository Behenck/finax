-- CreateTable
CREATE TABLE "partner_supervisors" (
    "partner_id" TEXT NOT NULL,
    "supervisor_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_supervisors_pkey" PRIMARY KEY ("partner_id", "supervisor_id")
);

-- Preserve current single-supervisor assignments.
INSERT INTO "partner_supervisors" ("partner_id", "supervisor_id", "organization_id")
SELECT "id", "supervisor_id", "organization_id"
FROM "partners"
WHERE "supervisor_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE INDEX "partner_supervisors_organization_id_idx" ON "partner_supervisors"("organization_id");

-- CreateIndex
CREATE INDEX "partner_supervisors_supervisor_id_idx" ON "partner_supervisors"("supervisor_id");

-- AddForeignKey
ALTER TABLE "partner_supervisors" ADD CONSTRAINT "partner_supervisors_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_supervisors" ADD CONSTRAINT "partner_supervisors_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_supervisors" ADD CONSTRAINT "partner_supervisors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "partners" DROP CONSTRAINT "partners_supervisor_id_fkey";

-- DropColumn
ALTER TABLE "partners" DROP COLUMN "supervisor_id";
