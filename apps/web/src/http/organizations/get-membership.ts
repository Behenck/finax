import {
	getOrganizationsSlugMembership,
	type GetOrganizationsSlugMembership200,
} from "../generated";

export async function getMembership(slug: string): Promise<
	GetOrganizationsSlugMembership200["membership"]
> {
	const data = await getOrganizationsSlugMembership({
		slug,
	});

	return data.membership;
}
