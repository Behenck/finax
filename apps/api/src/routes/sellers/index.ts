import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { createSeller } from "./create-seller";
import { updateSeller } from "./update-seller";
import { deleteSeller } from "./delete-seller";
import { getSellers } from "./get-sellers";
import { getSeller } from "./get-seller";

function resolveSellersPermission(params: { method: string; routeUrl: string }) {
  const { method, routeUrl } = params;

  if (
    routeUrl !== "/organizations/:slug/sellers" &&
    routeUrl !== "/organizations/:slug/sellers/:sellerId"
  ) {
    return null;
  }

  if (method === "GET") return "registers.sellers.view" as const;
  if (method === "POST") return "registers.sellers.create" as const;
  if (method === "PUT") return "registers.sellers.update" as const;
  if (method === "DELETE") return "registers.sellers.delete" as const;

  return null;
}

export async function sellerRoutes(app: FastifyInstance) {
  registerModulePermissionGuard(app, resolveSellersPermission);

  await app.register(createSeller);
  await app.register(updateSeller);
  await app.register(deleteSeller);
  await app.register(getSellers);
  await app.register(getSeller);
}
