import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { getCustomers } from "./get-customers";
import { createCustomer } from "./create-customer";
import { updateCustomer } from "./update-customer";
import { deleteCustomer } from "./delete-customer";
import { getCustomer } from "./get-customer";

function resolveCustomersPermission(params: { method: string; routeUrl: string }) {
  const { method, routeUrl } = params;

  if (
    routeUrl !== "/organizations/:slug/customers" &&
    routeUrl !== "/organizations/:slug/customers/:customerId"
  ) {
    return null;
  }

  if (method === "GET") return "registers.customers.view" as const;
  if (method === "POST") return "registers.customers.create" as const;
  if (method === "PUT") return "registers.customers.update" as const;
  if (method === "DELETE") return "registers.customers.delete" as const;

  return null;
}

export async function customerRoute(app: FastifyInstance) {
  registerModulePermissionGuard(app, resolveCustomersPermission);

  await app.register(createCustomer);
  await app.register(updateCustomer);
  await app.register(getCustomers);
  await app.register(getCustomer);
  await app.register(deleteCustomer);
}
