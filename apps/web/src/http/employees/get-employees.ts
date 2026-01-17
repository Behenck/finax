import {
	getOrganizationsSlugEmployees,
	type GetOrganizationsSlugEmployees200,
} from "../generated";

export async function getEmployees(): Promise<
	GetOrganizationsSlugEmployees200["employees"]
> {
	const slug = "behenck";
	const data = await getOrganizationsSlugEmployees({ slug });

	return data.employees;
}
