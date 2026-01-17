import { updateCategory } from "@/http/categories/update-category";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useUpdateCategory() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: updateCategory,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["categories"],
			});
			toast.success("Categoria atualizada com sucesso.");
		},
	});
}
