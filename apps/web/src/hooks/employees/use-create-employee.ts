import { createEmployee } from "@/http/employees/create-employee";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCreateEmployee() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: createEmployee,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["employees"],
			});
			toast.success("Funcionário criado com sucesso.");
		},
	});
}
