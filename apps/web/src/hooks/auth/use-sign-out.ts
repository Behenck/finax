import Cookies from "js-cookie";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "@/router";

export function useSignOut() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			// await api.post("/auth/logout");
		},

		onSuccess: async () => {
			// remove token local
			Cookies.remove("token");

			// limpa cache da sessão
			queryClient.setQueryData(["session"], null);

			// força router recalcular auth
			await router.invalidate();

			// redireciona
			router.navigate({
				to: "/sign-in",
				replace: true,
			});
		},
	});
}
