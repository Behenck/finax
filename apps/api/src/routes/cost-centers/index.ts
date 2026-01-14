import type { FastifyInstance } from "fastify";
import { createCostCenter } from "./create-cost-center";
import { updateCostCenter } from "./update-cost-center";
import { deleteCostCenter } from "./delete-cost-center";
import { getCostCenters } from "./get-cost-centers";

export async function costCenterRoutes(app: FastifyInstance) {
  await app.register(createCostCenter);
  await app.register(updateCostCenter);
  await app.register(deleteCostCenter);
  await app.register(getCostCenters);
}