import { createCategory } from "@/http/categories/create-category";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCreateCategory() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: createCategory,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["categories"],
			});
			toast.success("Categoria criada com sucesso.");
		},
	});
}
