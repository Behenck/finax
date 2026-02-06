import {
	putOrganizationsSlugCompaniesCompanyidUnitsUnitid,
	type PutOrganizationsSlugCompaniesCompanyidUnitsUnitidMutationRequest,
} from "../generated";

interface UpdateCompanyRequest {
	companyId: string;
	unitId: string;
	data: PutOrganizationsSlugCompaniesCompanyidUnitsUnitidMutationRequest;
}

export async function updateUnit({
	companyId,
	unitId,
	data,
}: UpdateCompanyRequest) {
	const slug = "behenck";

	await putOrganizationsSlugCompaniesCompanyidUnitsUnitid(slug, companyId, unitId, data);
}
