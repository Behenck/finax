import { api } from "@/lib/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useSignOut() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			await api.post("/auth/logout");
		},

		onSuccess: () => {
			queryClient.setQueryData(["session"], null);
		},
	});
}
