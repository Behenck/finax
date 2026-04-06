import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugSalesQueryKey,
	getOrganizationsSlugSalesSaleidCommissionInstallmentsQueryKey,
	getOrganizationsSlugSalesSaleidQueryKey,
} from "@/http/generated";
import { api } from "@/lib/axios";

interface ReverseSaleCommissionInstallmentInput {
	saleId: string;
	installmentId: string;
	reversalDate: string;
	manualAmount?: number;
	cancelPendingInstallments?: boolean;
	silent?: boolean;
}

export function useReverseSaleCommissionInstallment() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			saleId,
			installmentId,
			reversalDate,
			manualAmount,
			cancelPendingInstallments,
		}: ReverseSaleCommissionInstallmentInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await api.post(
				`/organizations/${organization.slug}/sales/${saleId}/commission-installments/${installmentId}/reversal`,
				{
					reversalDate,
					manualAmount,
					cancelPendingInstallments,
				},
			);
		},
		onSuccess: async (_, variables) => {
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
					queryKey: getOrganizationsSlugSalesSaleidQueryKey({
						slug: organization.slug,
						saleId: variables.saleId,
					}),
				}),
				queryClient.invalidateQueries({
					queryKey:
						getOrganizationsSlugSalesSaleidCommissionInstallmentsQueryKey({
							slug: organization.slug,
							saleId: variables.saleId,
						}),
				}),
				queryClient.invalidateQueries({
					queryKey: [
						{
							url: "/organizations/:slug/commissions/installments",
							params: {
								slug: organization.slug,
							},
						},
					],
				}),
			]);

			if (!variables.silent) {
				toast.success("Parcela estornada.");
			}
		},
		onError: (error, variables) => {
			if (variables?.silent) {
				return;
			}

			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
