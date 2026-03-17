import { api } from "@/lib/axios";
import type {
	CreateSaleImportTemplateBody,
	ExecuteSaleImportBody,
	SaleImportResult,
	SaleImportTemplatesResponse,
	UpdateSaleImportTemplateBody,
} from "@/schemas/types/sale-import";

export async function getSaleImportTemplates(params: {
	slug: string;
	headerSignature?: string;
}) {
	const response = await api.get<SaleImportTemplatesResponse>(
		`/organizations/${params.slug}/sales/import-templates`,
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

export async function createSaleImportTemplate(params: {
	slug: string;
	data: CreateSaleImportTemplateBody;
}) {
	const response = await api.post<{ templateId: string }>(
		`/organizations/${params.slug}/sales/import-templates`,
		params.data,
	);

	return response.data;
}

export async function updateSaleImportTemplate(params: {
	slug: string;
	templateId: string;
	data: UpdateSaleImportTemplateBody;
}) {
	await api.put(
		`/organizations/${params.slug}/sales/import-templates/${params.templateId}`,
		params.data,
	);
}

export async function deleteSaleImportTemplate(params: {
	slug: string;
	templateId: string;
}) {
	await api.delete(
		`/organizations/${params.slug}/sales/import-templates/${params.templateId}`,
	);
}

export async function executeSaleImport(params: {
	slug: string;
	data: ExecuteSaleImportBody;
}) {
	const response = await api.post<SaleImportResult>(
		`/organizations/${params.slug}/sales/imports`,
		params.data,
	);

	return response.data;
}
