import { useApp } from "@/context/app-context";
import { normalizeApiError } from "@/errors/api-error";
import { resolveErrorMessage } from "@/errors";
import {
	getOrganizationsSlugSalesQueryKey,
	postOrganizationsSlugSales,
	type PostOrganizationsSlugSalesMutationRequest,
} from "@/http/generated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCreateSale() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: PostOrganizationsSlugSalesMutationRequest) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return postOrganizationsSlugSales({
				slug: organization.slug,
				data,
			});
		},
		onSuccess: async () => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugSalesQueryKey({
					slug: organization.slug,
				}),
			});

			toast.success("Venda criada com sucesso.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}

