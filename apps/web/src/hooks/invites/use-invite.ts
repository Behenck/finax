import { getInvite } from "@/http/invites/get-invite";
import { useQuery } from "@tanstack/react-query";

export function UseInvite(inviteId: string) {
	return useQuery({
		queryKey: ["invites"],
		queryFn: () => getInvite(inviteId),
	});
}
