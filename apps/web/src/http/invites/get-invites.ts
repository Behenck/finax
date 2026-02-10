import {
	getOrganizationsSlugInvites,
	type GetOrganizationsSlugInvites200,
} from "../generated";

export async function getInvites(slug: string): Promise<
	GetOrganizationsSlugInvites200["invites"]
> {
	const data = await getOrganizationsSlugInvites(slug);

	return data.invites;
}
