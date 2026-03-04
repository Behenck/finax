import type { FastifyInstance } from "fastify";
import { createSale } from "./create-sale";
import { getSales } from "./get-sales";
import { getSale } from "./get-sale";
import { updateSale } from "./update-sale";
import { deleteSale } from "./delete-sale";
import { patchSaleStatus } from "./patch-sale-status";

export async function saleRoutes(app: FastifyInstance) {
	await app.register(createSale);
	await app.register(updateSale);
	await app.register(deleteSale);
	await app.register(getSales);
	await app.register(getSale);
	await app.register(patchSaleStatus);
}

