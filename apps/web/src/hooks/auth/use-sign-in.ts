import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postSessionsPassword } from "@/http/generated";
import { setAuthToken } from "@/lib/auth-token";

type SignInInput = {
	email: string;
	password: string;
};

export function useSignIn() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: SignInInput) => {
			const data = await postSessionsPassword({ data: payload });
			return data;
		},

		onSuccess: async (data) => {
			setAuthToken(data.accessToken);

			await queryClient.invalidateQueries({
				queryKey: ["session"],
			});
		},
	});
}
