import type { FastifyInstance } from "fastify";
import { createProduct } from "./create-product";
import { deleteProduct } from "./delete-product";
import { getProduct } from "./get-product";
import { getProductCommissionScenarios } from "./get-product-commission-scenarios";
import { getProducts } from "./get-products";
import { replaceProductCommissionScenarios } from "./replace-product-commission-scenarios";
import { updateProduct } from "./update-product";

export async function productRoutes(app: FastifyInstance) {
	await app.register(createProduct);
	await app.register(updateProduct);
	await app.register(getProducts);
	await app.register(getProduct);
	await app.register(getProductCommissionScenarios);
	await app.register(replaceProductCommissionScenarios);
	await app.register(deleteProduct);
}
