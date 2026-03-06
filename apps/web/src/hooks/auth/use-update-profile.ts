import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	patchMe,
	type PatchMeMutationRequest,
} from "@/http/generated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type UpdateProfileInput = PatchMeMutationRequest;

export function useUpdateProfile() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: UpdateProfileInput) => {
			return patchMe({
				data: payload,
			});
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["session"],
			});

			toast.success("Perfil atualizado com sucesso.");
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
