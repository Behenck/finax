import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	type GetOrganizationsSlugTransactions200,
	getOrganizationsSlugTransactionsQueryKey,
	type PutOrganizationsSlugTransactionsTransactionidMutationRequest,
} from "@/http/generated";
import { updateTransaction } from "@/http/transactions/update-transaction";

type RestorableTransaction =
	GetOrganizationsSlugTransactions200["transactions"][number];

interface RestoreTransactionsPendingInput {
	transactions: RestorableTransaction[];
	silent?: boolean;
}

function toPendingPayload(
	transaction: RestorableTransaction,
): PutOrganizationsSlugTransactionsTransactionidMutationRequest {
	return {
		description: transaction.description,
		totalAmount: transaction.totalAmount,
		type: transaction.type,
		status: "PENDING",
		nature: transaction.nature,
		dueDate: new Date(transaction.dueDate),
		expectedPaymentDate: new Date(transaction.expectedPaymentDate),
		paymentDate: undefined,
		costCenterId: transaction.costCenter.id,
		companyId: transaction.company.id,
		unitId: transaction.unit?.id ?? undefined,
		categoryId: transaction.category.children?.id ?? transaction.category.id,
		employeeIdRefunded: transaction.refundedByEmployee?.id ?? undefined,
	};
}

export function useRestoreTransactionsPending() {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ transactions }: RestoreTransactionsPendingInput) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			await Promise.all(
				transactions.map((transaction) =>
					updateTransaction({
						slug: organization.slug,
						transactionId: transaction.id,
						data: toPendingPayload(transaction),
					}),
				),
			);
		},
		onSuccess: async (_, variables) => {
			if (!organization?.slug) {
				return;
			}

			await queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugTransactionsQueryKey({
					slug: organization.slug,
				}),
			});

			if (!variables.silent) {
				toast.success(
					`${variables.transactions.length} transação(ões) retornaram para pendente.`,
				);
			}
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
