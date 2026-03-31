import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugSalesQueryKey,
	postOrganizationsSlugSalesBatch,
	type PostOrganizationsSlugSalesBatchMutationRequest,
} from "@/http/generated";

export function useCreateSalesBatch() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: PostOrganizationsSlugSalesBatchMutationRequest) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return postOrganizationsSlugSalesBatch({
				slug: organization.slug,
				data,
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

			toast.success(`${response.createdCount} venda(s) criada(s) com sucesso.`);
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
