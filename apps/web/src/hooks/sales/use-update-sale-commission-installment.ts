import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugSalesQueryKey,
	getOrganizationsSlugSalesSaleidCommissionInstallmentsQueryKey,
	getOrganizationsSlugSalesSaleidQueryKey,
	type PatchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidMutationRequest,
	patchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentid,
} from "@/http/generated";

interface UpdateSaleCommissionInstallmentInput {
	saleId: string;
	installmentId: string;
	data: PatchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentidMutationRequest;
}

export function useUpdateSaleCommissionInstallment() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			saleId,
			installmentId,
			data,
		}: UpdateSaleCommissionInstallmentInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await patchOrganizationsSlugSalesSaleidCommissionInstallmentsInstallmentid(
				{
					slug: organization.slug,
					saleId,
					installmentId,
					data,
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

			toast.success("Parcela atualizada.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
