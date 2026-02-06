import { updateTransaction } from "@/http/transactions/update-transaction";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useUpdateTransaction() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: updateTransaction,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["transactions"],
			});
			toast.success("Empresa atualizada com sucesso.");
		},
	});
}
