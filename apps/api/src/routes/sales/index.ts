import type { FastifyInstance } from "fastify";
import { createSale } from "./create-sale";
import { deleteSale } from "./delete-sale";
import { deleteSaleCommissionInstallment } from "./delete-sale-commission-installment";
import { getOrganizationCommissionInstallments } from "./get-organization-commission-installments";
import { getSale } from "./get-sale";
import { getSaleCommissionInstallments } from "./get-sale-commission-installments";
import { getSales } from "./get-sales";
import { patchSaleCommissionInstallment } from "./patch-sale-commission-installment";
import { patchSaleCommissionInstallmentStatus } from "./patch-sale-commission-installment-status";
import { patchSaleStatus } from "./patch-sale-status";
import { updateSale } from "./update-sale";

export async function saleRoutes(app: FastifyInstance) {
	await app.register(createSale);
	await app.register(updateSale);
	await app.register(deleteSale);
	await app.register(getOrganizationCommissionInstallments);
	await app.register(getSales);
	await app.register(getSale);
	await app.register(patchSaleStatus);
	await app.register(getSaleCommissionInstallments);
	await app.register(patchSaleCommissionInstallmentStatus);
	await app.register(patchSaleCommissionInstallment);
	await app.register(deleteSaleCommissionInstallment);
}
