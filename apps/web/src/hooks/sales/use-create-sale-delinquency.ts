import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import { postOrganizationsSlugSalesSaleidDelinquencies } from "@/http/generated";
import { invalidateSaleDelinquencyRelatedQueries } from "./sale-delinquency-cache";

interface CreateSaleDelinquencyInput {
	saleId: string;
	dueDate: string;
	customerId?: string;
}

export function useCreateSaleDelinquency() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ saleId, dueDate }: CreateSaleDelinquencyInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return postOrganizationsSlugSalesSaleidDelinquencies({
				slug: organization.slug,
				saleId,
				data: { dueDate },
			});
		},
		onSuccess: async (_, variables) => {
			if (!organization?.slug) {
				return;
			}

			await invalidateSaleDelinquencyRelatedQueries({
				queryClient,
				slug: organization.slug,
				saleId: variables.saleId,
				customerId: variables.customerId,
			});

			toast.success("Inadimplência adicionada com sucesso.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
