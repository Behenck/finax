import {
	putOrganizationsSlugCostcentersCostcenterid,
	type PutOrganizationsSlugCostcentersCostcenteridMutationRequest,
} from "../generated";

interface UpdateCostCenterRequest {
	costCenterId: string;
	data: PutOrganizationsSlugCostcentersCostcenteridMutationRequest;
}

export async function updateCostCenter({
	costCenterId,
	data,
}: UpdateCostCenterRequest) {
	const slug = "behenck";

	await putOrganizationsSlugCostcentersCostcenterid(
		{ costCenterId, slug },
		data,
	);
}
