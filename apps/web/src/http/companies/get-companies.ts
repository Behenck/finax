import { getOrganizationsSlugCompanies, type GetOrganizationsSlugCompanies200 } from "../generated"

export async function getCompanies(): Promise<GetOrganizationsSlugCompanies200["companies"]> {
  const slug = "behenck"
  const data = await getOrganizationsSlugCompanies({ slug })

  return data.companies
}