/*
  Warnings:

  - You are about to drop the column `percentage_x100` on the `product_commission_installments` table. All the data in the column will be lost.
  - You are about to drop the column `total_percentage_x100` on the `product_commissions` table. All the data in the column will be lost.
  - Added the required column `percentage` to the `product_commission_installments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_percentage` to the `product_commissions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "product_commission_scenario_conditions" DROP CONSTRAINT "product_commission_scenario_conditions_seller_id_fkey";

-- DropForeignKey
ALTER TABLE "product_commission_scenario_conditions" DROP CONSTRAINT "product_commission_scenario_conditions_unit_id_fkey";

-- AlterTable
ALTER TABLE "product_commission_installments" DROP COLUMN "percentage_x100",
ADD COLUMN     "percentage" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "product_commissions" DROP COLUMN "total_percentage_x100",
ADD COLUMN     "total_percentage" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "product_commission_scenario_conditions" ADD CONSTRAINT "product_commission_scenario_conditions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_commission_scenario_conditions" ADD CONSTRAINT "product_commission_scenario_conditions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "product_commission_installments_commission_id_installment_numbe" RENAME TO "product_commission_installments_commission_id_installment_n_key";

-- RenameIndex
ALTER INDEX "product_commission_scenario_conditions_scenario_id_sort_order_i" RENAME TO "product_commission_scenario_conditions_scenario_id_sort_ord_idx";

-- RenameIndex
ALTER INDEX "product_commission_scenarios_product_id_is_active_sort_order_id" RENAME TO "product_commission_scenarios_product_id_is_active_sort_orde_idx";
