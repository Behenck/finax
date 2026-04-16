import { postAuthVerifyOtp } from "@/http/generated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setAuthToken } from "@/lib/auth-token";

type SignInInput = {
	email: string;
	code: string;
};

export function useSignInOTP() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: SignInInput) => {
			const data = await postAuthVerifyOtp({ data: payload });
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
