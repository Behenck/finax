import { putOrganizationsSlugCompaniesCompanyid, type PutOrganizationsSlugCompaniesCompanyidMutationRequest } from '../generated'

interface UpdateCompanyRequest {
  companyId: string
  data: PutOrganizationsSlugCompaniesCompanyidMutationRequest
}

export async function updateCompany({
  companyId,
  data,
}: UpdateCompanyRequest) {
  const slug = "behenck"

  await putOrganizationsSlugCompaniesCompanyid({ companyId, slug }, data)
}
