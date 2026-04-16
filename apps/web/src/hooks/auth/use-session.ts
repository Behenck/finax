import type { GetMe200 } from "@/http/generated";
import { api } from "@/lib/axios";
import { getAuthToken } from "@/lib/auth-token";
import { useQuery } from "@tanstack/react-query";

export function useSession() {
	const token = getAuthToken();

	return useQuery<GetMe200>({
		queryKey: ["session"],
		enabled: !!token,
		retry: false,
		staleTime: Infinity,
		gcTime: Infinity,
		refetchOnMount: false,
		refetchOnWindowFocus: false,

		queryFn: async () => {
			const { data } = await api.get<GetMe200>("/me", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			return data;
		},
	});
}
