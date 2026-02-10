import {
	getOrganizations as getOrganizationsRoute,
	type GetOrganizations200,
} from "../generated";

export async function getOrganizations(): Promise<
	GetOrganizations200["organizations"]
> {
	const data = await getOrganizationsRoute();

	return data.organizations;
}
