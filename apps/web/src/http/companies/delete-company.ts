import { deleteOrganizationsSlugCompaniesCompanyid } from "../generated";

export async function deleteCompany(companyId: string) {
	const slug = "behenck";
	await deleteOrganizationsSlugCompaniesCompanyid(slug, companyId);
}
