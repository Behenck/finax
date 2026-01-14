import type { FastifyInstance } from "fastify";
import { createCompany } from "./create-company";
import { updateCompany } from "./update-company";
import { deleteCompany } from "./delete-company";
import { getCompanies } from "./get-companies";

export async function companyRoutes(app: FastifyInstance) {
  await app.register(createCompany);
  await app.register(updateCompany);
  await app.register(deleteCompany);
  await app.register(getCompanies);
}