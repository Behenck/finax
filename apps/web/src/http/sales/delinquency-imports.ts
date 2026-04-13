import { api } from "@/lib/axios";
import type {
	CreateSaleDelinquencyImportTemplateBody,
	ExecuteSaleDelinquencyImportApplyBody,
	ExecuteSaleDelinquencyImportPreviewBody,
	SaleDelinquencyImportApplyResult,
	SaleDelinquencyImportSearchFieldsResponse,
	SaleDelinquencyImportPreviewResult,
	SaleDelinquencyImportTemplatesResponse,
	UpdateSaleDelinquencyImportTemplateBody,
} from "@/schemas/types/sale-delinquency-import";

export async function getSaleDelinquencyImportTemplates(params: {
	slug: string;
	headerSignature?: string;
}) {
	const response = await api.get<SaleDelinquencyImportTemplatesResponse>(
		`/organizations/${params.slug}/sales/delinquency/import-templates`,
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

export async function createSaleDelinquencyImportTemplate(params: {
	slug: string;
	data: CreateSaleDelinquencyImportTemplateBody;
}) {
	const response = await api.post<{ templateId: string }>(
		`/organizations/${params.slug}/sales/delinquency/import-templates`,
		params.data,
	);

	return response.data;
}

export async function updateSaleDelinquencyImportTemplate(params: {
	slug: string;
	templateId: string;
	data: UpdateSaleDelinquencyImportTemplateBody;
}) {
	await api.put(
		`/organizations/${params.slug}/sales/delinquency/import-templates/${params.templateId}`,
		params.data,
	);
}

export async function deleteSaleDelinquencyImportTemplate(params: {
	slug: string;
	templateId: string;
}) {
	await api.delete(
		`/organizations/${params.slug}/sales/delinquency/import-templates/${params.templateId}`,
	);
}

export async function getSaleDelinquencyImportSearchFields(params: {
	slug: string;
	productId?: string;
}) {
	const response = await api.get<SaleDelinquencyImportSearchFieldsResponse>(
		`/organizations/${params.slug}/sales/delinquency/import-search-fields`,
		{
			params: params.productId
				? {
						productId: params.productId,
					}
				: undefined,
		},
	);

	return response.data;
}

export async function previewSaleDelinquencyImport(params: {
	slug: string;
	data: ExecuteSaleDelinquencyImportPreviewBody;
}) {
	const response = await api.post<SaleDelinquencyImportPreviewResult>(
		`/organizations/${params.slug}/sales/delinquency/imports/preview`,
		params.data,
	);

	return response.data;
}

export async function applySaleDelinquencyImport(params: {
	slug: string;
	data: ExecuteSaleDelinquencyImportApplyBody;
}) {
	const response = await api.post<SaleDelinquencyImportApplyResult>(
		`/organizations/${params.slug}/sales/delinquency/imports/apply`,
		params.data,
	);

	return response.data;
}
