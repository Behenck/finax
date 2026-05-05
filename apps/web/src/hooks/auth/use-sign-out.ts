import { useMutation } from "@tanstack/react-query";
import { performClientSignOut } from "@/lib/session-logout";

export function useSignOut() {
	return useMutation({
		mutationFn: async () => {
			// await api.post("/auth/logout");
			await performClientSignOut();
		},
	});
}
