import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { createUnit } from "./create-unit";
import { updateUnit } from "./update-unit";
import { getUnits } from "./get-units";
import { deleteUnit } from "./delete-unit";

function resolveUnitsPermission(params: { method: string; routeUrl: string }) {
  const { method, routeUrl } = params;

  if (
    routeUrl !== "/organizations/:slug/companies/:companyId/units" &&
    routeUrl !== "/organizations/:slug/companies/:companyId/units/:unitId"
  ) {
    return null;
  }

  if (method === "GET") return "registers.units.view" as const;
  if (method === "POST") return "registers.units.create" as const;
  if (method === "PUT") return "registers.units.update" as const;
  if (method === "DELETE") return "registers.units.delete" as const;

  return null;
}

export async function unitRoutes(app: FastifyInstance) {
  registerModulePermissionGuard(app, resolveUnitsPermission);

  await app.register(createUnit);
  await app.register(updateUnit);
  await app.register(getUnits);
  await app.register(deleteUnit);
}
