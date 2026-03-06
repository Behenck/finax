import {
	postSessionsGoogleComplete,
	type PostSessionsGoogleCompleteMutationRequest,
} from "@/http/generated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";

type CompleteGoogleSignInInput = PostSessionsGoogleCompleteMutationRequest;

export function useCompleteGoogleSignIn() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: CompleteGoogleSignInInput) => {
			return postSessionsGoogleComplete({
				data: payload,
			});
		},
		onSuccess: async (data) => {
			Cookies.set("token", data.accessToken);

			await queryClient.invalidateQueries({
				queryKey: ["session"],
			});
		},
	});
}
