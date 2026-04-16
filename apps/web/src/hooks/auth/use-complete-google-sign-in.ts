import {
	postSessionsGoogleComplete,
	type PostSessionsGoogleCompleteMutationRequest,
} from "@/http/generated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setAuthToken } from "@/lib/auth-token";

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
			setAuthToken(data.accessToken);

			await queryClient.invalidateQueries({
				queryKey: ["session"],
			});
		},
	});
}
