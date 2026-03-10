-- CreateEnum
CREATE TYPE "SaleHistoryAction" AS ENUM (
  'CREATED',
  'UPDATED',
  'STATUS_CHANGED',
  'COMMISSION_INSTALLMENT_UPDATED',
  'COMMISSION_INSTALLMENT_STATUS_UPDATED',
  'COMMISSION_INSTALLMENT_DELETED'
);

-- CreateTable
CREATE TABLE "sale_history_events" (
  "id" TEXT NOT NULL,
  "sale_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "action" "SaleHistoryAction" NOT NULL,
  "changes" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sale_history_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_history_events_sale_id_idx" ON "sale_history_events"("sale_id");

-- CreateIndex
CREATE INDEX "sale_history_events_organization_id_sale_id_created_at_idx" ON "sale_history_events"("organization_id", "sale_id", "created_at");

-- CreateIndex
CREATE INDEX "sale_history_events_actor_id_idx" ON "sale_history_events"("actor_id");

-- AddForeignKey
ALTER TABLE "sale_history_events"
ADD CONSTRAINT "sale_history_events_sale_id_fkey"
FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_history_events"
ADD CONSTRAINT "sale_history_events_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_history_events"
ADD CONSTRAINT "sale_history_events_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
