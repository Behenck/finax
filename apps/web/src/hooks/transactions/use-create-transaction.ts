import { createTransaction } from "@/http/transactions/create-transaction";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCreateTransaction() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: createTransaction,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["transactions"],
			});
			toast.success("Transação criada com sucesso.");
		},
	});
}
