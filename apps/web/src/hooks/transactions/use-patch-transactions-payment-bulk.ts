import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugTransactionsQueryKey,
	patchOrganizationsSlugTransactionsPaymentBulk,
} from "@/http/generated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface PatchTransactionsPaymentBulkInput {
	transactionIds: string[];
	paymentDate?: Date;
	silent?: boolean;
}

export function usePatchTransactionsPaymentBulk() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			transactionIds,
			paymentDate,
		}: PatchTransactionsPaymentBulkInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return patchOrganizationsSlugTransactionsPaymentBulk({
				slug: organization.slug,
				data: {
					transactionIds,
					paymentDate,
				},
			});
		},
		onSuccess: async (response, variables) => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugTransactionsQueryKey({
					slug: organization.slug,
				}),
			});

			if (!variables.silent && response.updatedCount > 0) {
				toast.success(`${response.updatedCount} transação(ões) baixada(s).`);
			}

			if (!variables.silent && response.skipped.length > 0) {
				toast.warning(
					`${response.skipped.length} transação(ões) ignorada(s) por status não elegível.`,
				);
			}
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
