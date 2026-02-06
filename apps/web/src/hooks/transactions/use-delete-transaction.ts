import { deleteTransaction } from "@/http/transactions/delete-transaction";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useDeleteTransaction() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: deleteTransaction,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["transaction"],
			});
			toast.success("Transação removida com sucesso.");
		},
	});
}
