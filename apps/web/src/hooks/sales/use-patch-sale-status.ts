import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugPartnersQueryKey,
	getOrganizationsSlugSalesQueryKey,
	getOrganizationsSlugSalesSaleidQueryKey,
	patchOrganizationsSlugSalesSaleidStatus,
	type PatchOrganizationsSlugSalesSaleidStatusMutationRequestStatusEnumKey,
} from "@/http/generated";
import { SALE_STATUS_LABEL } from "@/schemas/types/sales";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface PatchSaleStatusInput {
	saleId: string;
	status: PatchOrganizationsSlugSalesSaleidStatusMutationRequestStatusEnumKey;
}

export function usePatchSaleStatus() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ saleId, status }: PatchSaleStatusInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await patchOrganizationsSlugSalesSaleidStatus({
				slug: organization.slug,
				saleId,
				data: { status },
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
					queryKey: getOrganizationsSlugPartnersQueryKey({
						slug: organization.slug,
					}),
				}),
			]);

			toast.success(`Status alterado para ${SALE_STATUS_LABEL[variables.status]}.`);
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
