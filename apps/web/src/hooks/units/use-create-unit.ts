import { createUnit } from "@/http/units/create-unit";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCreateUnit() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: createUnit,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["units"],
			});
			queryClient.invalidateQueries({
				queryKey: ["companies"],
			});
			toast.success("Unidade criada com sucesso.");
		},
	});
}
