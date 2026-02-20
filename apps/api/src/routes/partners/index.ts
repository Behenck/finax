import type { FastifyInstance } from "fastify";
import { createPartner } from "./create-partner";
import { updatePartner } from "./update-partner";
import { deletePartner } from "./delete-partner";
import { getPartners } from "./get-partners";
import { getPartner } from "./get-partner";
import { assignSupervisorPartner } from "./assign-supervisor-partner";

export async function partnerRoutes(app: FastifyInstance) {
  await app.register(createPartner);
  await app.register(updatePartner);
  await app.register(deletePartner);
  await app.register(getPartners);
  await app.register(getPartner);
  await app.register(assignSupervisorPartner);
}