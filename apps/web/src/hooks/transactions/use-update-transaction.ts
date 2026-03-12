import { updateTransaction } from "@/http/transactions/update-transaction";
import { useApp } from "@/context/app-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useUpdateTransaction() {
	const queryClient = useQueryClient();
	const { organization } = useApp();

	return useMutation({
		mutationFn: (
			params: Omit<Parameters<typeof updateTransaction>[0], "slug">,
		) => {
			if (!organization?.slug) {
				throw new Error("Organização não encontrada");
			}

			return updateTransaction({
				...params,
				slug: organization.slug,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["transactions"],
			});
			toast.success("Transação atualizada com sucesso.");
		},
	});
}
