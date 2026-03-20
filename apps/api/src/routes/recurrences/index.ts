import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { createRecurrence } from "./create-recurrence";
import { deleteRecurrence } from "./delete-recurrence";
import { updateRecurrence } from "./update-recurrence";
import { toggleRecurrenceStatus } from "./toggle-recurrence-status";
import { getRecurrences } from "./get-recurrences";

function resolveRecurrencesPermission(params: { method: string; routeUrl: string }) {
  const { method, routeUrl } = params;

  if (routeUrl !== "/organizations/:slug/recurrences" && routeUrl !== "/organizations/:slug/recurrences/:recurrenceId") {
    return null;
  }

  if (method === "GET") {
    return "transactions.recurrences.view" as const;
  }

  return "transactions.recurrences.manage" as const;
}

export async function recurrencesRoutes(app: FastifyInstance) {
  registerModulePermissionGuard(app, resolveRecurrencesPermission);

  await app.register(createRecurrence);
  await app.register(deleteRecurrence);
  await app.register(updateRecurrence);
  await app.register(toggleRecurrenceStatus);
  await app.register(getRecurrences);
}
