import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	deleteOrganizationsSlugSalesSaleid,
	getOrganizationsSlugSalesQueryKey,
	getOrganizationsSlugSalesSaleidQueryKey,
} from "@/http/generated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface DeleteSaleInput {
	saleId: string;
}

export function useDeleteSale() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ saleId }: DeleteSaleInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await deleteOrganizationsSlugSalesSaleid({
				slug: organization.slug,
				saleId,
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
				queryClient.removeQueries({
					queryKey: getOrganizationsSlugSalesSaleidQueryKey({
						slug: organization.slug,
						saleId: variables.saleId,
					}),
				}),
			]);

			toast.success("Venda excluída com sucesso.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}

