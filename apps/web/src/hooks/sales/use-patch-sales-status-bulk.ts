import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugPartnersQueryKey,
	getOrganizationsSlugSalesQueryKey,
	patchOrganizationsSlugSalesStatusBulk,
	type PatchOrganizationsSlugSalesStatusBulkMutationRequestStatusEnumKey,
} from "@/http/generated";
import { SALE_STATUS_LABEL } from "@/schemas/types/sales";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface PatchSalesStatusBulkInput {
	saleIds: string[];
	status: PatchOrganizationsSlugSalesStatusBulkMutationRequestStatusEnumKey;
}

export function usePatchSalesStatusBulk() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ saleIds, status }: PatchSalesStatusBulkInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return patchOrganizationsSlugSalesStatusBulk({
				slug: organization.slug,
				data: {
					saleIds,
					status,
				},
			});
		},
		onSuccess: async (response, variables) => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugSalesQueryKey({
					slug: organization.slug,
				}),
			});
			await queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugPartnersQueryKey({
					slug: organization.slug,
				}),
			});

			toast.success(
				`${response.updated} venda(s) alterada(s) para ${SALE_STATUS_LABEL[variables.status]}.`,
			);
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
