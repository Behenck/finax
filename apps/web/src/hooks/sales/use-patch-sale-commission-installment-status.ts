import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugSalesQueryKey,
	getOrganizationsSlugSalesSaleidCommissionInstallmentsQueryKey,
	getOrganizationsSlugSalesSaleidQueryKey,
	type PatchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidStatusMutationRequestStatusEnumKey,
	patchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidStatus,
} from "@/http/generated";

const INSTALLMENT_STATUS_SUCCESS_MESSAGE: Record<
	PatchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidStatusMutationRequestStatusEnumKey,
	string
> = {
	PAID: "Parcela marcada como paga.",
	CANCELED: "Parcela cancelada.",
};

interface PatchSaleCommissionInstallmentStatusInput {
	saleId: string;
	installmentId: string;
	status: PatchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidStatusMutationRequestStatusEnumKey;
	paymentDate?: string;
	reversalDate?: string;
	amount?: number;
	silent?: boolean;
}

export function usePatchSaleCommissionInstallmentStatus() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			saleId,
			installmentId,
			status,
			paymentDate,
			reversalDate,
			amount,
		}: PatchSaleCommissionInstallmentStatusInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await patchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidStatus(
				{
					slug: organization.slug,
					saleId,
					installmentId,
					data: {
						status,
						paymentDate,
						reversalDate,
						amount,
					},
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
				toast.success(INSTALLMENT_STATUS_SUCCESS_MESSAGE[variables.status]);
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
