import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	patchMePassword,
	type PatchMePasswordMutationRequest,
} from "@/http/generated";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSignOut } from "./use-sign-out";

type ChangePasswordInput = PatchMePasswordMutationRequest;

export function useChangePassword() {
	const signOut = useSignOut();

	return useMutation({
		mutationFn: async (payload: ChangePasswordInput) => {
			await patchMePassword({
				data: payload,
			});
		},
		onSuccess: async () => {
			toast.success("Senha alterada com sucesso. Faça login novamente.");
			await signOut.mutateAsync();
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
