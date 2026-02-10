import { getMembers } from "@/http/members/get-members";
import { useQuery } from "@tanstack/react-query";

export function useMembers(org: string) {
	return useQuery({
		queryKey: ["members"],
		queryFn: () => getMembers(org),
	});
}
