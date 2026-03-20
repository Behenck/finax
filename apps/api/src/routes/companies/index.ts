import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { createCompany } from "./create-company";
import { updateCompany } from "./update-company";
import { deleteCompany } from "./delete-company";
import { getCompanies } from "./get-companies";

function resolveCompaniesPermission(params: { method: string; routeUrl: string }) {
  const { method, routeUrl } = params;

  if (
    routeUrl !== "/organizations/:slug/companies" &&
    routeUrl !== "/organizations/:slug/companies/:companyId"
  ) {
    return null;
  }

  if (method === "GET") return "registers.companies.view" as const;
  if (method === "POST") return "registers.companies.create" as const;
  if (method === "PUT") return "registers.companies.update" as const;
  if (method === "DELETE") return "registers.companies.delete" as const;

  return null;
}

export async function companyRoutes(app: FastifyInstance) {
  registerModulePermissionGuard(app, resolveCompaniesPermission);

  await app.register(createCompany);
  await app.register(updateCompany);
  await app.register(deleteCompany);
  await app.register(getCompanies);
}
