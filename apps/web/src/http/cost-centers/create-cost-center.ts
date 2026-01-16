import { postOrganizationsSlugCostcenters, type PostOrganizationsSlugCostcentersMutationRequest } from '../generated'

export async function createCostCenter(data: PostOrganizationsSlugCostcentersMutationRequest) {
  const slug = "behenck"
  await postOrganizationsSlugCostcenters({ slug }, data)
}
