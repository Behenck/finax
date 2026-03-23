import { getOrganizationsSlugInvitesQueryKey } from "@/http/generated";
import { getInvites } from "@/http/invites/get-invites";
import { useQuery } from "@tanstack/react-query";

export function UseInvites(org: string) {
	return useQuery({
		queryKey: getOrganizationsSlugInvitesQueryKey({ slug: org }),
		queryFn: () => getInvites(org),
		enabled: Boolean(org),
	});
}
