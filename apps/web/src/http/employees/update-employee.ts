import { putOrganizationsSlugEmployeesEmployeeid, type PutOrganizationsSlugEmployeesEmployeeidMutationRequest } from '../generated'

interface UpdateEmployeeRequest {
  employeeId: string
  data: PutOrganizationsSlugEmployeesEmployeeidMutationRequest
}

export async function updateEmployee({
  employeeId,
  data,
}: UpdateEmployeeRequest) {
  const slug = "behenck"

  await putOrganizationsSlugEmployeesEmployeeid({ employeeId, slug }, data)
}
