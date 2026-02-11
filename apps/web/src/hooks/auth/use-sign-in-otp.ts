import { useMutation, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { verifyOTP } from "@/http/auth/verify-otp";

type SignInInput = {
	email: string;
	code: string;
};

export function useSignInOTP() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: SignInInput) => {
			const data = await verifyOTP(payload)
			return data;
		},

		onSuccess: async (data) => {
			Cookies.set("token", data.accessToken);

			await queryClient.invalidateQueries({
				queryKey: ["session"],
			});
		},
	});
}
