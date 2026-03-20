import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { createCostCenter } from "./create-cost-center";
import { updateCostCenter } from "./update-cost-center";
import { deleteCostCenter } from "./delete-cost-center";
import { getCostCenters } from "./get-cost-centers";

function resolveCostCentersPermission(params: { method: string; routeUrl: string }) {
  const { method, routeUrl } = params;

  if (
    routeUrl !== "/organizations/:slug/costCenters" &&
    routeUrl !== "/organizations/:slug/costCenters/:costCenterId"
  ) {
    return null;
  }

  if (method === "GET") return "registers.cost-centers.view" as const;
  if (method === "POST") return "registers.cost-centers.create" as const;
  if (method === "PUT") return "registers.cost-centers.update" as const;
  if (method === "DELETE") return "registers.cost-centers.delete" as const;

  return null;
}

export async function costCenterRoutes(app: FastifyInstance) {
  registerModulePermissionGuard(app, resolveCostCentersPermission);

  await app.register(createCostCenter);
  await app.register(updateCostCenter);
  await app.register(deleteCostCenter);
  await app.register(getCostCenters);
}
