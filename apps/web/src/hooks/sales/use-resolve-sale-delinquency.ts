import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import { patchOrganizationsSlugSalesSaleidDelinquenciesDelinquencyidResolve } from "@/http/generated";
import { invalidateSaleDelinquencyRelatedQueries } from "./sale-delinquency-cache";

interface ResolveSaleDelinquencyInput {
	saleId: string;
	delinquencyId: string;
	customerId?: string;
}

export function useResolveSaleDelinquency() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ saleId, delinquencyId }: ResolveSaleDelinquencyInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await patchOrganizationsSlugSalesSaleidDelinquenciesDelinquencyidResolve({
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

			toast.success("Inadimplência resolvida com sucesso.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
