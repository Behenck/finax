import { deleteOrganizationsSlugCompaniesCompanyidUnitsUnitid } from "../generated"

interface DeleteUnitProps {
  companyId: string,
  unitId: string
}

export async function deleteUnit({ companyId, unitId }: DeleteUnitProps) {
  const slug = "behenck"
  await deleteOrganizationsSlugCompaniesCompanyidUnitsUnitid({ slug, companyId, unitId })
}
