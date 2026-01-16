import { postOrganizationsSlugEmployees, type PostOrganizationsSlugEmployeesMutationRequest } from '../generated'

export async function createEmployee(data: PostOrganizationsSlugEmployeesMutationRequest) {
  const slug = "behenck"
  await postOrganizationsSlugEmployees({ slug }, data)
}
