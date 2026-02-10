import { getInvitesInviteid, type GetInvitesInviteid200 } from "../generated";

export async function getInvite(inviteId: string): Promise<
	GetInvitesInviteid200
> {
	const { invite } = await getInvitesInviteid(inviteId);

	return invite;
}
