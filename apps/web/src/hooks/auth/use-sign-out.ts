import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "@/router";
import { removeAuthToken } from "@/lib/auth-token";

export function useSignOut() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			// await api.post("/auth/logout");
		},

		onSuccess: async () => {
			removeAuthToken();

			queryClient.setQueryData(["session"], null);

			await router.invalidate();

			router.navigate({
				to: "/sign-in",
				replace: true,
			});
		},
	});
}
