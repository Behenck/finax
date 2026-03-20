import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { createEmployee } from "./create-employee";
import { updateEmployee } from "./update-employee";
import { deleteEmployee } from "./delete-employee";
import { getEmployees } from "./get-employees";

function resolveEmployeesPermission(params: { method: string; routeUrl: string }) {
  const { method, routeUrl } = params;

  if (
    routeUrl !== "/organizations/:slug/employees" &&
    routeUrl !== "/organizations/:slug/employees/:employeeId"
  ) {
    return null;
  }

  if (method === "GET") return "registers.employees.view" as const;
  if (method === "POST") return "registers.employees.create" as const;
  if (method === "PUT") return "registers.employees.update" as const;
  if (method === "DELETE") return "registers.employees.delete" as const;

  return null;
}

export async function employeeRoutes(app: FastifyInstance) {
  registerModulePermissionGuard(app, resolveEmployeesPermission);

  await app.register(createEmployee);
  await app.register(updateEmployee);
  await app.register(deleteEmployee);
  await app.register(getEmployees);
}
