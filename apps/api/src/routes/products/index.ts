import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { createProduct } from "./create-product";
import { deleteProduct } from "./delete-product";
import { getProduct } from "./get-product";
import { getProductBonusScenarios } from "./get-product-bonus-scenarios";
import { getProductCommissionScenarios } from "./get-product-commission-scenarios";
import { getProductCommissionReversalRules } from "./get-product-commission-reversal-rules";
import { getProductSaleFields } from "./get-product-sale-fields";
import { getProducts } from "./get-products";
import { replaceProductBonusScenarios } from "./replace-product-bonus-scenarios";
import { replaceProductCommissionScenarios } from "./replace-product-commission-scenarios";
import { replaceProductCommissionReversalRules } from "./replace-product-commission-reversal-rules";
import { replaceProductSaleFields } from "./replace-product-sale-fields";
import { updateProduct } from "./update-product";

function resolveProductsPermission(params: {
	method: string;
	routeUrl: string;
}) {
	const { method, routeUrl } = params;
	const salesReadPermissions = [
		"sales.view",
		"sales.create",
		"sales.update",
	] as const;

	if (routeUrl === "/organizations/:slug/products/:id/commission-scenarios") {
		if (method === "GET") {
			return [
				"registers.products.view",
				"sales.commissions.create",
				"sales.commissions.update",
				"sales.commissions.manage",
			] as const;
		}

		if (method === "PUT") {
			return "registers.products.commissions.manage" as const;
		}
	}

	if (routeUrl === "/organizations/:slug/products/:id/bonus-scenarios") {
		if (method === "GET") {
			return [
				"registers.products.view",
				"sales.commissions.create",
				"sales.commissions.update",
				"sales.commissions.manage",
			] as const;
		}

		if (method === "PUT") {
			return "registers.products.commissions.manage" as const;
		}
	}

	if (
		routeUrl === "/organizations/:slug/products/:id/commission-reversal-rules"
	) {
		if (method === "GET") {
			return ["registers.products.view", ...salesReadPermissions] as const;
		}

		if (method === "PUT") {
			return "registers.products.commissions.manage" as const;
		}
	}

	if (routeUrl === "/organizations/:slug/products/:id/sale-fields") {
		if (method === "GET") {
			return ["registers.products.view", ...salesReadPermissions] as const;
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

	if (method === "GET") {
		return ["registers.products.view", ...salesReadPermissions] as const;
	}
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
	await app.register(getProductBonusScenarios);
	await app.register(replaceProductBonusScenarios);
	await app.register(getProductCommissionReversalRules);
	await app.register(replaceProductCommissionReversalRules);
	await app.register(getProductSaleFields);
	await app.register(replaceProductSaleFields);
	await app.register(deleteProduct);
}
