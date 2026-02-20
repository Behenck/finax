import type { FastifyInstance } from "fastify";
import { createSeller } from "./create-seller";
import { updateSeller } from "./update-seller";
import { deleteSeller } from "./delete-seller";
import { getSellers } from "./get-sellers";
import { getSeller } from "./get-seller";

export async function sellerRoutes(app: FastifyInstance) {
  await app.register(createSeller);
  await app.register(updateSeller);
  await app.register(deleteSeller);
  await app.register(getSellers);
  await app.register(getSeller);
}