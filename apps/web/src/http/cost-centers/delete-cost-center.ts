import { deleteOrganizationsSlugCostcentersCostcenterid } from "../generated";

export async function deleteCostCenter(costCenterId: string) {
	const slug = "behenck";
	await deleteOrganizationsSlugCostcentersCostcenterid(slug, costCenterId);
}
