import type { GetMe200 } from "@/http/generated";
import { api } from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import Cookies from "js-cookie";

export function useSession() {
	const token = Cookies.get("token");

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
