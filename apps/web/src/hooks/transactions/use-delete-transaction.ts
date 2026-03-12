import { deleteTransaction } from "@/http/transactions/delete-transaction";
import { useApp } from "@/context/app-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useDeleteTransaction() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: (transactionId: string) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return deleteTransaction({
				slug: organization.slug,
				transactionId,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["transaction"],
			});
			queryClient.invalidateQueries({
				queryKey: ["transactions"],
			});
			toast.success("Transação removida com sucesso.");
		},
	});
}
