import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { normalizeApiError } from "@/errors/api-error";
import { resolveErrorMessage } from "@/errors";
import {
	createSaleImportTemplate,
	deleteSaleImportTemplate,
	executeSaleImport,
	getSaleImportTemplates,
	updateSaleImportTemplate,
} from "@/http/sales/imports";
import type {
	CreateSaleImportTemplateBody,
	ExecuteSaleImportBody,
	UpdateSaleImportTemplateBody,
} from "@/schemas/types/sale-import";
import { getOrganizationsSlugSalesQueryKey } from "@/http/generated";

function saleImportTemplatesQueryKey(slug: string, headerSignature?: string) {
	return ["sales", "import-templates", slug, headerSignature ?? ""];
}

interface UseSaleImportTemplatesOptions {
	headerSignature?: string;
	enabled?: boolean;
}

export function useSaleImportTemplates(options?: UseSaleImportTemplatesOptions) {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useQuery({
		queryKey: saleImportTemplatesQueryKey(slug, options?.headerSignature),
		queryFn: () =>
			getSaleImportTemplates({
				slug,
				headerSignature: options?.headerSignature,
			}),
		enabled: Boolean(slug) && (options?.enabled ?? true),
	});
}

export function useCreateSaleImportTemplate() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: async (data: CreateSaleImportTemplateBody) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return createSaleImportTemplate({
				slug: organization.slug,
				data,
			});
		},
		onSuccess: async () => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: ["sales", "import-templates", organization.slug],
				predicate: (query) =>
					Array.isArray(query.queryKey) &&
					query.queryKey[0] === "sales" &&
					query.queryKey[1] === "import-templates" &&
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

export function useUpdateSaleImportTemplate() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: async (params: {
			templateId: string;
			data: UpdateSaleImportTemplateBody;
		}) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await updateSaleImportTemplate({
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
				queryKey: ["sales", "import-templates", organization.slug],
				predicate: (query) =>
					Array.isArray(query.queryKey) &&
					query.queryKey[0] === "sales" &&
					query.queryKey[1] === "import-templates" &&
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

export function useDeleteSaleImportTemplate() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: async (templateId: string) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await deleteSaleImportTemplate({
				slug: organization.slug,
				templateId,
			});
		},
		onSuccess: async () => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: ["sales", "import-templates", organization.slug],
				predicate: (query) =>
					Array.isArray(query.queryKey) &&
					query.queryKey[0] === "sales" &&
					query.queryKey[1] === "import-templates" &&
					query.queryKey[2] === organization.slug,
			});
			toast.success("Modelo de importação removido.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}

export function useExecuteSaleImport() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: async (data: ExecuteSaleImportBody) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return executeSaleImport({
				slug: organization.slug,
				data,
			});
		},
		onSuccess: async () => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugSalesQueryKey({
					slug: organization.slug,
				}),
			});
			toast.success("Importação finalizada.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
