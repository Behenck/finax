import { deleteCostCenter } from "@/http/cost-centers/delete-cost-center";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useDeleteCostCenter() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: deleteCostCenter,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["cost-centers"],
			});
			toast.success("Centro de custo removido com sucesso.");
		},
	});
}
