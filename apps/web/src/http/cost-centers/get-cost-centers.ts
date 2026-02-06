import {
	getOrganizationsSlugCostcenters,
	type GetOrganizationsSlugCostcenters200,
} from "../generated";

export async function getCostCenters(): Promise<
	GetOrganizationsSlugCostcenters200["costCenters"]
> {
	const slug = "behenck";
	const data = await getOrganizationsSlugCostcenters(slug);

	return data.costCenters;
}
