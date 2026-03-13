import { deleteOrganizationsSlugEmployeesEmployeeid } from "@/http/generated/deleteOrganizationsSlugEmployeesEmployeeid";
import { getOrganizationsSlugEmployees } from "@/http/generated/getOrganizationsSlugEmployees";
import { postOrganizationsSlugEmployees } from "@/http/generated/postOrganizationsSlugEmployees";
import { putOrganizationsSlugEmployeesEmployeeid } from "@/http/generated/putOrganizationsSlugEmployeesEmployeeid";
import type { PostOrganizationsSlugEmployeesMutationRequest } from "@/http/generated/models/PostOrganizationsSlugEmployees";
import type { PutOrganizationsSlugEmployeesEmployeeidMutationRequest } from "@/http/generated/models/PutOrganizationsSlugEmployeesEmployeeid";
import type { Employee, EmployeeInput } from "@/types/registers";
import { undefinedIfEmpty } from "./utils";

function normalizeEmployeePayload(input: EmployeeInput): EmployeeInput {
  return {
    name: input.name.trim(),
    role: undefinedIfEmpty(input.role),
    email: input.email.trim().toLowerCase(),
    phone: undefinedIfEmpty(input.phone),
    department: undefinedIfEmpty(input.department),
    cpf: undefinedIfEmpty(input.cpf),
    pixKeyType: input.pixKeyType,
    pixKey: undefinedIfEmpty(input.pixKey),
    paymentNotes: undefinedIfEmpty(input.paymentNotes),
    country: undefinedIfEmpty(input.country),
    state: undefinedIfEmpty(input.state),
    city: undefinedIfEmpty(input.city),
    street: undefinedIfEmpty(input.street),
    zipCode: undefinedIfEmpty(input.zipCode),
    neighborhood: undefinedIfEmpty(input.neighborhood),
    number: undefinedIfEmpty(input.number),
    complement: undefinedIfEmpty(input.complement),
    companyId: input.companyId,
    unitId: undefinedIfEmpty(input.unitId),
  };
}

export async function listEmployees(slug: string): Promise<Employee[]> {
  const data = await getOrganizationsSlugEmployees({ slug });
  return data.employees as Employee[];
}

export async function createEmployee(slug: string, payload: EmployeeInput): Promise<string> {
  const data = await postOrganizationsSlugEmployees({
    slug,
    data: normalizeEmployeePayload(payload) as PostOrganizationsSlugEmployeesMutationRequest,
  });
  return data.employeeId;
}

export async function updateEmployee(
  slug: string,
  employeeId: string,
  payload: EmployeeInput,
): Promise<void> {
  await putOrganizationsSlugEmployeesEmployeeid({
    slug,
    employeeId,
    data: normalizeEmployeePayload(payload) as PutOrganizationsSlugEmployeesEmployeeidMutationRequest,
  });
}

export async function deleteEmployee(slug: string, employeeId: string): Promise<void> {
  await deleteOrganizationsSlugEmployeesEmployeeid({ slug, employeeId });
}
