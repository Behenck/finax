import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import { api } from "@/lib/axios";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

type StartGoogleSyncResponse = {
	authorizationUrl: string;
};

export function useSyncGoogleProfile() {
	return useMutation({
		mutationFn: async () => {
			const response = await api.post<StartGoogleSyncResponse>("/me/google/sync");
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
