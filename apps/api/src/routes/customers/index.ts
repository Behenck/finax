import type { FastifyInstance } from "fastify";
import { getCustomers } from "./get-customers";
import { createCustomer } from "./create-customer";
import { updateCustomer } from "./update-customer";
import { deleteCustomer } from "./delete-customer";

export async function customerRoute(app: FastifyInstance) {
  await app.register(createCustomer);
  await app.register(updateCustomer);
  await app.register(getCustomers);
  await app.register(deleteCustomer);
}