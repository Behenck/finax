import type { FastifyInstance } from "fastify";
import { createEmployee } from "./create-employee";
import { updateEmployee } from "./update-employee";
import { deleteEmployee } from "./delete-employee";
import { getEmployees } from "./get-employees";

export async function employeeRoutes(app: FastifyInstance) {
  await app.register(createEmployee);
  await app.register(updateEmployee);
  await app.register(deleteEmployee);
  await app.register(getEmployees);
}