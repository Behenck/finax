import type { FastifyInstance } from "fastify";
import { createUnit } from "./create-unit";
import { updateUnit } from "./update-unit";
import { getUnits } from "./get-units";
import { deleteUnit } from "./delete-unit";

export async function unitRoutes(app: FastifyInstance) {
  await app.register(createUnit);
  await app.register(updateUnit);
  await app.register(getUnits);
  await app.register(deleteUnit);
}