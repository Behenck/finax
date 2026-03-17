import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugSalesQueryKey,
	patchOrganizationsSlugSalesDeleteBulk,
} from "@/http/generated";

interface DeleteSalesBulkInput {
	saleIds: string[];
}

export function useDeleteSalesBulk() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ saleIds }: DeleteSalesBulkInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return patchOrganizationsSlugSalesDeleteBulk({
				slug: organization.slug,
				data: {
					saleIds,
				},
			});
		},
		onSuccess: async (response) => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugSalesQueryKey({
					slug: organization.slug,
				}),
			});

			toast.success(`${response.deleted} venda(s) excluída(s) com sucesso.`);
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
