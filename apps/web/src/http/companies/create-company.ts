import { postOrganizationsSlugCompanies, type PostOrganizationsSlugCompaniesMutationRequest } from '../generated'

export async function createCompany(data: PostOrganizationsSlugCompaniesMutationRequest) {
  const slug = "behenck"
  await postOrganizationsSlugCompanies({ slug }, data)
}
