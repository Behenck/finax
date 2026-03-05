import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	deleteOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentid,
	getOrganizationsSlugSalesQueryKey,
	getOrganizationsSlugSalesSaleidCommissionInstallmentsQueryKey,
	getOrganizationsSlugSalesSaleidQueryKey,
} from "@/http/generated";

interface DeleteSaleCommissionInstallmentInput {
	saleId: string;
	installmentId: string;
}

export function useDeleteSaleCommissionInstallment() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			saleId,
			installmentId,
		}: DeleteSaleCommissionInstallmentInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await deleteOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentid(
				{
					slug: organization.slug,
					saleId,
					installmentId,
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

			toast.success("Parcela excluída.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
