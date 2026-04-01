import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { createCommissionReceiptImportTemplate } from "./create-commission-receipt-import-template";
import { createSale } from "./create-sale";
import { createSaleImportTemplate } from "./create-sale-import-template";
import { deleteCommissionReceiptImportTemplate } from "./delete-commission-receipt-import-template";
import { deleteSale } from "./delete-sale";
import { deleteSaleCommissionInstallment } from "./delete-sale-commission-installment";
import { deleteSaleImportTemplate } from "./delete-sale-import-template";
import { getCommissionReceiptImportTemplates } from "./get-commission-receipt-import-templates";
import { getOrganizationCommissionInstallments } from "./get-organization-commission-installments";
import { getSale } from "./get-sale";
import { getSaleCommissionInstallments } from "./get-sale-commission-installments";
import { getSaleHistory } from "./get-sale-history";
import { getSaleImportTemplates } from "./get-sale-import-templates";
import { getSales } from "./get-sales";
import { getSalesDashboard } from "./get-sales-dashboard";
import { patchSaleCommissionInstallment } from "./patch-sale-commission-installment";
import { patchSaleCommissionInstallmentStatus } from "./patch-sale-commission-installment-status";
import { patchSaleStatus } from "./patch-sale-status";
import { patchSalesDeleteBulk } from "./patch-sales-delete-bulk";
import { patchSalesStatusBulk } from "./patch-sales-status-bulk";
import { postCommissionReceiptImportApply } from "./post-commission-receipt-import-apply";
import { postCommissionReceiptImportPreview } from "./post-commission-receipt-import-preview";
import { postSalesBatch } from "./post-sales-batch";
import { postSalesImport } from "./post-sales-import";
import { updateCommissionReceiptImportTemplate } from "./update-commission-receipt-import-template";
import { updateSale } from "./update-sale";
import { updateSaleImportTemplate } from "./update-sale-import-template";

function resolveSalesPermission(params: { method: string; routeUrl: string }) {
	const { method, routeUrl } = params;

	if (
		routeUrl === "/organizations/:slug/sales/import-templates" ||
		routeUrl === "/organizations/:slug/sales/import-templates/:templateId" ||
		routeUrl === "/organizations/:slug/sales/imports" ||
		routeUrl === "/organizations/:slug/commissions/receipts/import-templates" ||
		routeUrl ===
			"/organizations/:slug/commissions/receipts/import-templates/:templateId" ||
		routeUrl === "/organizations/:slug/commissions/receipts/imports/preview" ||
		routeUrl === "/organizations/:slug/commissions/receipts/imports/apply"
	) {
		return "sales.import.manage" as const;
	}

	if (
		routeUrl === "/organizations/:slug/sales/:saleId/commission-installments"
	) {
		return "sales.view" as const;
	}

	if (
		routeUrl ===
			"/organizations/:slug/sales/:saleId/commission-installments/:installmentId/status" &&
		method === "PATCH"
	) {
		return "sales.commissions.installments.status.change" as const;
	}

	if (
		routeUrl ===
			"/organizations/:slug/sales/:saleId/commission-installments/:installmentId" &&
		method === "PATCH"
	) {
		return "sales.commissions.installments.update" as const;
	}

	if (
		routeUrl ===
			"/organizations/:slug/sales/:saleId/commission-installments/:installmentId" &&
		method === "DELETE"
	) {
		return "sales.commissions.installments.delete" as const;
	}

	if (
		routeUrl === "/organizations/:slug/sales/:saleId/status" ||
		routeUrl === "/organizations/:slug/sales/status/bulk"
	) {
		return "sales.status.change" as const;
	}

	if (routeUrl === "/organizations/:slug/sales/delete/bulk") {
		return "sales.delete" as const;
	}

	if (routeUrl === "/organizations/:slug/sales/dashboard") {
		return "sales.dashboard.view" as const;
	}

	if (routeUrl === "/organizations/:slug/sales" && method === "POST") {
		return "sales.create" as const;
	}

	if (routeUrl === "/organizations/:slug/sales/batch" && method === "POST") {
		return "sales.create" as const;
	}

	if (routeUrl === "/organizations/:slug/sales/:saleId" && method === "PUT") {
		return ["sales.update", "sales.create"] as const;
	}

	if (
		routeUrl === "/organizations/:slug/sales/:saleId" &&
		method === "DELETE"
	) {
		return "sales.delete" as const;
	}

	if (
		routeUrl === "/organizations/:slug/sales" ||
		routeUrl === "/organizations/:slug/sales/:saleId" ||
		routeUrl === "/organizations/:slug/sales/:saleId/history" ||
		routeUrl === "/organizations/:slug/commissions/installments"
	) {
		return "sales.view" as const;
	}

	return null;
}

export async function saleRoutes(app: FastifyInstance) {
	registerModulePermissionGuard(app, resolveSalesPermission);

	await app.register(createSale);
	await app.register(postSalesBatch);
	await app.register(updateSale);
	await app.register(deleteSale);
	await app.register(getOrganizationCommissionInstallments);
	await app.register(getSalesDashboard);
	await app.register(getSales);
	await app.register(getSale);
	await app.register(getSaleHistory);
	await app.register(patchSaleStatus);
	await app.register(patchSalesStatusBulk);
	await app.register(patchSalesDeleteBulk);
	await app.register(getSaleCommissionInstallments);
	await app.register(patchSaleCommissionInstallmentStatus);
	await app.register(patchSaleCommissionInstallment);
	await app.register(deleteSaleCommissionInstallment);
	await app.register(getCommissionReceiptImportTemplates);
	await app.register(createCommissionReceiptImportTemplate);
	await app.register(updateCommissionReceiptImportTemplate);
	await app.register(deleteCommissionReceiptImportTemplate);
	await app.register(postCommissionReceiptImportPreview);
	await app.register(postCommissionReceiptImportApply);
	await app.register(getSaleImportTemplates);
	await app.register(createSaleImportTemplate);
	await app.register(updateSaleImportTemplate);
	await app.register(deleteSaleImportTemplate);
	await app.register(postSalesImport);
}
