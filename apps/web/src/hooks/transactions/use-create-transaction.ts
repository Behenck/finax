import { createTransaction } from "@/http/transactions/create-transaction";
import { useApp } from "@/context/app-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCreateTransaction() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: (data: Parameters<typeof createTransaction>[0]["data"]) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return createTransaction({
				slug: organization.slug,
				data,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["transactions"],
			});
			toast.success("Transação criada com sucesso.");
		},
	});
}
