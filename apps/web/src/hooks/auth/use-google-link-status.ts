import { api } from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";

type GoogleLinkStatusResponse = {
	isLinked: boolean;
};

export function useGoogleLinkStatus() {
	return useQuery({
		queryKey: ["google-link-status"],
		retry: false,
		queryFn: async () => {
			const response = await api.get<GoogleLinkStatusResponse>("/me/google/status");
			return response.data;
		},
	});
}
