import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	applyCommissionReceiptImport,
	createCommissionReceiptImportTemplate,
	deleteCommissionReceiptImportTemplate,
	getCommissionReceiptImportTemplates,
	previewCommissionReceiptImport,
	updateCommissionReceiptImportTemplate,
} from "@/http/commissions/receipt-imports";
import type {
	CreateCommissionReceiptImportTemplateBody,
	ExecuteCommissionReceiptImportApplyBody,
	ExecuteCommissionReceiptImportPreviewBody,
	UpdateCommissionReceiptImportTemplateBody,
} from "@/schemas/types/commission-receipt-import";

function commissionReceiptImportTemplatesQueryKey(
	slug: string,
	headerSignature?: string,
) {
	return [
		"commissions",
		"receipt-import-templates",
		slug,
		headerSignature ?? "",
	];
}

interface UseCommissionReceiptImportTemplatesOptions {
	headerSignature?: string;
	enabled?: boolean;
}

export function useCommissionReceiptImportTemplates(
	options?: UseCommissionReceiptImportTemplatesOptions,
) {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useQuery({
		queryKey: commissionReceiptImportTemplatesQueryKey(
			slug,
			options?.headerSignature,
		),
		queryFn: () =>
			getCommissionReceiptImportTemplates({
				slug,
				headerSignature: options?.headerSignature,
			}),
		enabled: Boolean(slug) && (options?.enabled ?? true),
	});
}

export function useCreateCommissionReceiptImportTemplate() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: async (data: CreateCommissionReceiptImportTemplateBody) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return createCommissionReceiptImportTemplate({
				slug: organization.slug,
				data,
			});
		},
		onSuccess: async () => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: [
					"commissions",
					"receipt-import-templates",
					organization.slug,
				],
				predicate: (query) =>
					Array.isArray(query.queryKey) &&
					query.queryKey[0] === "commissions" &&
					query.queryKey[1] === "receipt-import-templates" &&
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

export function useUpdateCommissionReceiptImportTemplate() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: async (params: {
			templateId: string;
			data: UpdateCommissionReceiptImportTemplateBody;
		}) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await updateCommissionReceiptImportTemplate({
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
				queryKey: [
					"commissions",
					"receipt-import-templates",
					organization.slug,
				],
				predicate: (query) =>
					Array.isArray(query.queryKey) &&
					query.queryKey[0] === "commissions" &&
					query.queryKey[1] === "receipt-import-templates" &&
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

export function useDeleteCommissionReceiptImportTemplate() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: async (templateId: string) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await deleteCommissionReceiptImportTemplate({
				slug: organization.slug,
				templateId,
			});
		},
		onSuccess: async () => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: [
					"commissions",
					"receipt-import-templates",
					organization.slug,
				],
				predicate: (query) =>
					Array.isArray(query.queryKey) &&
					query.queryKey[0] === "commissions" &&
					query.queryKey[1] === "receipt-import-templates" &&
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

export function usePreviewCommissionReceiptImport() {
	const { organization } = useApp();

	return useMutation({
		mutationFn: async (data: ExecuteCommissionReceiptImportPreviewBody) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return previewCommissionReceiptImport({
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

export function useApplyCommissionReceiptImport() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: async (data: ExecuteCommissionReceiptImportApplyBody) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return applyCommissionReceiptImport({
				slug: organization.slug,
				data,
			});
		},
		onSuccess: async () => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				predicate: (query) => {
					if (!Array.isArray(query.queryKey) || query.queryKey.length === 0) {
						return false;
					}

					const firstPart = query.queryKey[0] as
						| {
								url?: string;
								params?: { slug?: string };
						  }
						| undefined;

					return (
						firstPart?.url ===
							"/organizations/:slug/commissions/installments" &&
						firstPart?.params?.slug === organization.slug
					);
				},
			});
			toast.success("Importação aplicada com sucesso.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
