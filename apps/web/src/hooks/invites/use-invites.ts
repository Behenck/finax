import { getInvites } from "@/http/invites/get-invites";
import { useQuery } from "@tanstack/react-query";

export function UseInvites(org: string) {
	return useQuery({
		queryKey: ["invites"],
		queryFn: () => getInvites(org),
	});
}
