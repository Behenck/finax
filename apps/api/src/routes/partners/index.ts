import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { createPartner } from "./create-partner";
import { updatePartner } from "./update-partner";
import { deletePartner } from "./delete-partner";
import { getPartners } from "./get-partners";
import { getPartner } from "./get-partner";
import { assignSupervisorPartner } from "./assign-supervisor-partner";

function resolvePartnersPermission(params: { method: string; routeUrl: string }) {
  const { method, routeUrl } = params;

  if (
    routeUrl === "/organizations/:slug/partners/:partnerId/assign-supervisor"
  ) {
    return "registers.partners.update" as const;
  }

  if (
    routeUrl !== "/organizations/:slug/partners" &&
    routeUrl !== "/organizations/:slug/partners/:partnerId"
  ) {
    return null;
  }

  if (method === "GET") return "registers.partners.view" as const;
  if (method === "POST") return "registers.partners.create" as const;
  if (method === "PUT") return "registers.partners.update" as const;
  if (method === "DELETE") return "registers.partners.delete" as const;

  return null;
}

export async function partnerRoutes(app: FastifyInstance) {
  registerModulePermissionGuard(app, resolvePartnersPermission);

  await app.register(createPartner);
  await app.register(updatePartner);
  await app.register(deletePartner);
  await app.register(getPartners);
  await app.register(getPartner);
  await app.register(assignSupervisorPartner);
}
