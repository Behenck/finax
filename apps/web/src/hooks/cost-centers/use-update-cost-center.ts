import { updateCostCenter } from "@/http/cost-centers/update-cost-center";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useUpdateCostCenter() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: updateCostCenter,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["cost-centers"],
			});
			toast.success("Centro de custo atualizado com sucesso.");
		},
	});
}
