import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugSalesQueryKey,
	getOrganizationsSlugSalesSaleidCommissionInstallmentsQueryKey,
	getOrganizationsSlugSalesSaleidQueryKey,
	postOrganizationsSlugSalesSaleidCommissionInstallments,
	type PostOrganizationsSlugSalesSaleidCommissionInstallmentsMutationRequest,
} from "@/http/generated";

interface CreateSaleCommissionInstallmentInput {
	saleId: string;
	data: PostOrganizationsSlugSalesSaleidCommissionInstallmentsMutationRequest;
	silent?: boolean;
}

export function useCreateSaleCommissionInstallment() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			saleId,
			data,
		}: CreateSaleCommissionInstallmentInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await postOrganizationsSlugSalesSaleidCommissionInstallments({
				slug: organization.slug,
				saleId,
				data,
			});
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
				toast.success("Parcela adicionada.");
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
