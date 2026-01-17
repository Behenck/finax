import { createCostCenter } from "@/http/cost-centers/create-cost-center";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCreateCostCenter() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: createCostCenter,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["cost-centers"],
			});
			toast.success("Centro de custo criado com sucesso.");
		},
	});
}
