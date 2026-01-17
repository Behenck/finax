import { updateEmployee } from "@/http/employees/update-employee";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useUpdateEmployee() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: updateEmployee,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["employee"],
			});
			toast.success("Funcionário atualizado com sucesso.");
		},
	});
}
