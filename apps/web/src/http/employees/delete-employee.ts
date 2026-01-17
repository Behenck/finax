import { deleteOrganizationsSlugEmployeesEmployeeid } from "../generated";

export async function deleteEmployee(employeeId: string) {
	const slug = "behenck";
	await deleteOrganizationsSlugEmployeesEmployeeid({ slug, employeeId });
}
