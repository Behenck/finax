import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import { api } from "@/lib/axios";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

type StartGoogleLinkResponse = {
	authorizationUrl: string;
};

export function useLinkGoogleAccount() {
	return useMutation({
		mutationFn: async () => {
			const response = await api.post<StartGoogleLinkResponse>("/me/google/link");
			return response.data;
		},
		onSuccess: (data) => {
			window.location.href = data.authorizationUrl;
		},
		onError: (error) => {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		},
	});
}
