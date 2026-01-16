import { postOrganizationsSlugCompaniesCompanyidUnits, type PostOrganizationsSlugCompaniesCompanyidUnitsMutationRequest } from '../generated'

interface CreateUnitProps {
  companyId: string
  data: PostOrganizationsSlugCompaniesCompanyidUnitsMutationRequest
}

export async function createUnit({ companyId, data }: CreateUnitProps) {
  const slug = "behenck"
  await postOrganizationsSlugCompaniesCompanyidUnits({ slug, companyId }, data)
}
