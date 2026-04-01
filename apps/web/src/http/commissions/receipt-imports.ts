import { api } from "@/lib/axios";
import type {
	CommissionReceiptImportApplyResult,
	CommissionReceiptImportPreviewResult,
	CommissionReceiptImportTemplatesResponse,
	CreateCommissionReceiptImportTemplateBody,
	ExecuteCommissionReceiptImportApplyBody,
	ExecuteCommissionReceiptImportPreviewBody,
	UpdateCommissionReceiptImportTemplateBody,
} from "@/schemas/types/commission-receipt-import";

export async function getCommissionReceiptImportTemplates(params: {
	slug: string;
	headerSignature?: string;
}) {
	const response = await api.get<CommissionReceiptImportTemplatesResponse>(
		`/organizations/${params.slug}/commissions/receipts/import-templates`,
		{
			params: params.headerSignature
				? {
						headerSignature: params.headerSignature,
					}
				: undefined,
		},
	);

	return response.data;
}

export async function createCommissionReceiptImportTemplate(params: {
	slug: string;
	data: CreateCommissionReceiptImportTemplateBody;
}) {
	const response = await api.post<{ templateId: string }>(
		`/organizations/${params.slug}/commissions/receipts/import-templates`,
		params.data,
	);

	return response.data;
}

export async function updateCommissionReceiptImportTemplate(params: {
	slug: string;
	templateId: string;
	data: UpdateCommissionReceiptImportTemplateBody;
}) {
	await api.put(
		`/organizations/${params.slug}/commissions/receipts/import-templates/${params.templateId}`,
		params.data,
	);
}

export async function deleteCommissionReceiptImportTemplate(params: {
	slug: string;
	templateId: string;
}) {
	await api.delete(
		`/organizations/${params.slug}/commissions/receipts/import-templates/${params.templateId}`,
	);
}

export async function previewCommissionReceiptImport(params: {
	slug: string;
	data: ExecuteCommissionReceiptImportPreviewBody;
}) {
	const response = await api.post<CommissionReceiptImportPreviewResult>(
		`/organizations/${params.slug}/commissions/receipts/imports/preview`,
		params.data,
	);

	return response.data;
}

export async function applyCommissionReceiptImport(params: {
	slug: string;
	data: ExecuteCommissionReceiptImportApplyBody;
}) {
	const response = await api.post<CommissionReceiptImportApplyResult>(
		`/organizations/${params.slug}/commissions/receipts/imports/apply`,
		params.data,
	);

	return response.data;
}
