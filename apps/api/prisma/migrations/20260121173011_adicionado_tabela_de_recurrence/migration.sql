-- CreateEnum
CREATE TYPE "RecurrenceDayType" AS ENUM ('CALENDAR_DAY', 'BUSINESS_DAY');

-- CreateEnum
CREATE TYPE "RecurrenceAdjustment" AS ENUM ('NONE', 'NEXT_BUSINESS_DAY', 'PREVIOUS_BUSINESS_DAY');

-- CreateTable
CREATE TABLE "Recurrence" (
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

    CONSTRAINT "Recurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recurrence_start_date_end_date_idx" ON "Recurrence"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "Recurrence_company_id_idx" ON "Recurrence"("company_id");

-- CreateIndex
CREATE INDEX "Recurrence_unit_id_idx" ON "Recurrence"("unit_id");

-- CreateIndex
CREATE INDEX "Recurrence_execution_day_type_execution_day_idx" ON "Recurrence"("execution_day_type", "execution_day");

-- CreateIndex
CREATE INDEX "Recurrence_frequency_execution_day_type_idx" ON "Recurrence"("frequency", "execution_day_type");
