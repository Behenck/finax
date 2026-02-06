import {
	getOrganizationsSlugCompaniesCompanyidUnits,
	type GetOrganizationsSlugCompaniesCompanyidUnits200,
} from "../generated";

export async function getUnits(
	companyId: string,
): Promise<GetOrganizationsSlugCompaniesCompanyidUnits200["units"]> {
	const slug = "behenck";
	const data = await getOrganizationsSlugCompaniesCompanyidUnits(slug, companyId);

	return data.units;
}
