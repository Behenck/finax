import { deleteCategory } from "@/http/categories/delete-category";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useDeleteCategory() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: deleteCategory,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["categories"],
			});
			toast.success("Categoria removida com sucesso.");
		},
	});
}
