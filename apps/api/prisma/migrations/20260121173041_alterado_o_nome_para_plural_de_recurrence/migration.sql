/*
  Warnings:

  - You are about to drop the `Recurrence` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Recurrence";

-- CreateTable
CREATE TABLE "recurrences" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "company_id" TEXT NOT NULL,
    "unit_id" TEXT,
    "category_id" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "execution_day" INTEGER NOT NULL,
    "execution_day_type" "RecurrenceDayType" NOT NULL,
    "adjustment_rule" "RecurrenceAdjustment" NOT NULL,

    CONSTRAINT "recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurrences_start_date_end_date_idx" ON "recurrences"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "recurrences_company_id_idx" ON "recurrences"("company_id");

-- CreateIndex
CREATE INDEX "recurrences_unit_id_idx" ON "recurrences"("unit_id");

-- CreateIndex
CREATE INDEX "recurrences_execution_day_type_execution_day_idx" ON "recurrences"("execution_day_type", "execution_day");

-- CreateIndex
CREATE INDEX "recurrences_frequency_execution_day_type_idx" ON "recurrences"("frequency", "execution_day_type");
