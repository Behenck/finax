import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugSalesSaleidCommissionInstallmentsQueryKey,
	getOrganizationsSlugSalesQueryKey,
	getOrganizationsSlugSalesSaleidQueryKey,
	putOrganizationsSlugSalesSaleid,
	type PutOrganizationsSlugSalesSaleidMutationRequest,
} from "@/http/generated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface UpdateSaleInput {
	saleId: string;
	data: PutOrganizationsSlugSalesSaleidMutationRequest;
}

export function useUpdateSale() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ saleId, data }: UpdateSaleInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await putOrganizationsSlugSalesSaleid({
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
			]);

			toast.success("Venda atualizada com sucesso.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
