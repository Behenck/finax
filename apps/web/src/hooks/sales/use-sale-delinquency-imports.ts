import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugSalesDelinquencyQueryKey,
	getOrganizationsSlugSalesQueryKey,
} from "@/http/generated";
import {
	applySaleDelinquencyImport,
	createSaleDelinquencyImportTemplate,
	deleteSaleDelinquencyImportTemplate,
	getSaleDelinquencyImportSearchFields,
	getSaleDelinquencyImportTemplates,
	previewSaleDelinquencyImport,
	updateSaleDelinquencyImportTemplate,
} from "@/http/sales/delinquency-imports";
import type {
	CreateSaleDelinquencyImportTemplateBody,
	ExecuteSaleDelinquencyImportApplyBody,
	ExecuteSaleDelinquencyImportPreviewBody,
	UpdateSaleDelinquencyImportTemplateBody,
} from "@/schemas/types/sale-delinquency-import";

function saleDelinquencyImportTemplatesQueryKey(
	slug: string,
	headerSignature?: string,
) {
	return ["sales", "delinquency-import-templates", slug, headerSignature ?? ""];
}

function saleDelinquencyImportSearchFieldsQueryKey(
	slug: string,
	productId?: string,
) {
	return ["sales", "delinquency-import-search-fields", slug, productId ?? ""];
}

interface UseSaleDelinquencyImportTemplatesOptions {
	headerSignature?: string;
	enabled?: boolean;
}

export function useSaleDelinquencyImportTemplates(
	options?: UseSaleDelinquencyImportTemplatesOptions,
) {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useQuery({
		queryKey: saleDelinquencyImportTemplatesQueryKey(
			slug,
			options?.headerSignature,
		),
		queryFn: () =>
			getSaleDelinquencyImportTemplates({
				slug,
				headerSignature: options?.headerSignature,
			}),
		enabled: Boolean(slug) && (options?.enabled ?? true),
	});
}

interface UseSaleDelinquencyImportSearchFieldsOptions {
	enabled?: boolean;
	productId?: string;
}

export function useSaleDelinquencyImportSearchFields(
	options?: UseSaleDelinquencyImportSearchFieldsOptions,
) {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useQuery({
		queryKey: saleDelinquencyImportSearchFieldsQueryKey(
			slug,
			options?.productId,
		),
		queryFn: () =>
			getSaleDelinquencyImportSearchFields({
				slug,
				productId: options?.productId,
			}),
		enabled: Boolean(slug) && (options?.enabled ?? true),
	});
}

export function useCreateSaleDelinquencyImportTemplate() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: async (data: CreateSaleDelinquencyImportTemplateBody) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return createSaleDelinquencyImportTemplate({
				slug: organization.slug,
				data,
			});
		},
		onSuccess: async () => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: ["sales", "delinquency-import-templates", organization.slug],
				predicate: (query) =>
					Array.isArray(query.queryKey) &&
					query.queryKey[0] === "sales" &&
					query.queryKey[1] === "delinquency-import-templates" &&
					query.queryKey[2] === organization.slug,
			});
			toast.success("Modelo de importação salvo com sucesso.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}

export function useUpdateSaleDelinquencyImportTemplate() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: async (params: {
			templateId: string;
			data: UpdateSaleDelinquencyImportTemplateBody;
		}) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await updateSaleDelinquencyImportTemplate({
				slug: organization.slug,
				templateId: params.templateId,
				data: params.data,
			});
		},
		onSuccess: async () => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: ["sales", "delinquency-import-templates", organization.slug],
				predicate: (query) =>
					Array.isArray(query.queryKey) &&
					query.queryKey[0] === "sales" &&
					query.queryKey[1] === "delinquency-import-templates" &&
					query.queryKey[2] === organization.slug,
			});
			toast.success("Modelo de importação atualizado com sucesso.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}

export function useDeleteSaleDelinquencyImportTemplate() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: async (templateId: string) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await deleteSaleDelinquencyImportTemplate({
				slug: organization.slug,
				templateId,
			});
		},
		onSuccess: async () => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: ["sales", "delinquency-import-templates", organization.slug],
				predicate: (query) =>
					Array.isArray(query.queryKey) &&
					query.queryKey[0] === "sales" &&
					query.queryKey[1] === "delinquency-import-templates" &&
					query.queryKey[2] === organization.slug,
			});
			toast.success("Modelo removido.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}

export function usePreviewSaleDelinquencyImport() {
	const { organization } = useApp();

	return useMutation({
		mutationFn: async (data: ExecuteSaleDelinquencyImportPreviewBody) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return previewSaleDelinquencyImport({
				slug: organization.slug,
				data,
			});
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}

export function useApplySaleDelinquencyImport() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: async (data: ExecuteSaleDelinquencyImportApplyBody) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return applySaleDelinquencyImport({
				slug: organization.slug,
				data,
			});
		},
		onSuccess: async () => {
			if (!organization?.slug) {
				return;
			}

			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: getOrganizationsSlugSalesQueryKey({
						slug: organization.slug,
					}),
				}),
				queryClient.invalidateQueries({
					queryKey: getOrganizationsSlugSalesDelinquencyQueryKey({
						slug: organization.slug,
					}),
				}),
			]);
			toast.success("Importação de inadimplência aplicada com sucesso.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
