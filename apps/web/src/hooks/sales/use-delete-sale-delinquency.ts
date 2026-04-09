import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import { deleteOrganizationsSlugSalesSaleidDelinquenciesDelinquencyid } from "@/http/generated";
import { invalidateSaleDelinquencyRelatedQueries } from "./sale-delinquency-cache";

interface DeleteSaleDelinquencyInput {
	saleId: string;
	delinquencyId: string;
	customerId?: string;
}

export function useDeleteSaleDelinquency() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			saleId,
			delinquencyId,
		}: DeleteSaleDelinquencyInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await deleteOrganizationsSlugSalesSaleidDelinquenciesDelinquencyid({
				slug: organization.slug,
				saleId,
				delinquencyId,
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

			toast.success("Inadimplência excluída com sucesso.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
