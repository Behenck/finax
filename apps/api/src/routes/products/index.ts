import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { createProduct } from "./create-product";
import { deleteProduct } from "./delete-product";
import { getProduct } from "./get-product";
import { getProductCommissionScenarios } from "./get-product-commission-scenarios";
import { getProductSaleFields } from "./get-product-sale-fields";
import { getProducts } from "./get-products";
import { replaceProductCommissionScenarios } from "./replace-product-commission-scenarios";
import { replaceProductSaleFields } from "./replace-product-sale-fields";
import { updateProduct } from "./update-product";

function resolveProductsPermission(params: { method: string; routeUrl: string }) {
	const { method, routeUrl } = params;

	if (routeUrl === "/organizations/:slug/products/:id/commission-scenarios") {
		if (method === "GET") {
			return "registers.products.view" as const;
		}

		if (method === "PUT") {
			return "registers.products.commissions.manage" as const;
		}
	}

	if (routeUrl === "/organizations/:slug/products/:id/sale-fields") {
		if (method === "GET") {
			return "registers.products.view" as const;
		}

		if (method === "PUT") {
			return "registers.products.fields.manage" as const;
		}
	}

	if (
		routeUrl !== "/organizations/:slug/products" &&
		routeUrl !== "/organizations/:slug/products/:id"
	) {
		return null;
	}

	if (method === "GET") return "registers.products.view" as const;
	if (method === "POST") return "registers.products.create" as const;
	if (method === "PUT") return "registers.products.update" as const;
	if (method === "DELETE") return "registers.products.delete" as const;

	return null;
}

export async function productRoutes(app: FastifyInstance) {
	registerModulePermissionGuard(app, resolveProductsPermission);

	await app.register(createProduct);
	await app.register(updateProduct);
	await app.register(getProducts);
	await app.register(getProduct);
	await app.register(getProductCommissionScenarios);
	await app.register(replaceProductCommissionScenarios);
	await app.register(getProductSaleFields);
	await app.register(replaceProductSaleFields);
	await app.register(deleteProduct);
}
