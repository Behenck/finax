import {
	getOrganizationsSlugMembers,
	type GetOrganizationsSlugMembers200,
} from "../generated";

export async function getMembers(slug: string): Promise<
	GetOrganizationsSlugMembers200["members"]
> {
	const data = await getOrganizationsSlugMembers({
		slug,
	});

	return data.members;
}
