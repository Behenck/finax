import type { FastifyInstance } from "fastify";
import { createSale } from "./create-sale";
import { deleteSale } from "./delete-sale";
import { deleteSaleCommissionInstallment } from "./delete-sale-commission-installment";
import { getOrganizationCommissionInstallments } from "./get-organization-commission-installments";
import { getSale } from "./get-sale";
import { getSaleHistory } from "./get-sale-history";
import { getSaleCommissionInstallments } from "./get-sale-commission-installments";
import { getSales } from "./get-sales";
import { getSalesDashboard } from "./get-sales-dashboard";
import { patchSaleCommissionInstallment } from "./patch-sale-commission-installment";
import { patchSaleCommissionInstallmentStatus } from "./patch-sale-commission-installment-status";
import { patchSaleStatus } from "./patch-sale-status";
import { patchSalesStatusBulk } from "./patch-sales-status-bulk";
import { updateSale } from "./update-sale";

export async function saleRoutes(app: FastifyInstance) {
	await app.register(createSale);
	await app.register(updateSale);
	await app.register(deleteSale);
	await app.register(getOrganizationCommissionInstallments);
	await app.register(getSalesDashboard);
	await app.register(getSales);
	await app.register(getSale);
	await app.register(getSaleHistory);
	await app.register(patchSaleStatus);
	await app.register(patchSalesStatusBulk);
	await app.register(getSaleCommissionInstallments);
	await app.register(patchSaleCommissionInstallmentStatus);
	await app.register(patchSaleCommissionInstallment);
	await app.register(deleteSaleCommissionInstallment);
}
