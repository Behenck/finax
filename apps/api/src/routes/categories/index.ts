import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { getCategories } from "./get-categories";
import { createCategory } from "./create-category";
import { updateCategory } from "./update-category";
import { deleteCategory } from "./delete-category";

function resolveCategoriesPermission(params: { method: string; routeUrl: string }) {
  const { method, routeUrl } = params;

  if (
    routeUrl !== "/organizations/:slug/categories" &&
    routeUrl !== "/organizations/:slug/categories/:id"
  ) {
    return null;
  }

  if (method === "GET") return "registers.categories.view" as const;
  if (method === "POST") return "registers.categories.create" as const;
  if (method === "PUT") return "registers.categories.update" as const;
  if (method === "DELETE") return "registers.categories.delete" as const;

  return null;
}

export async function categoryRoutes(app: FastifyInstance) {
  registerModulePermissionGuard(app, resolveCategoriesPermission);

  await app.register(getCategories);
  await app.register(createCategory);
  await app.register(updateCategory);
  await app.register(deleteCategory);
}
