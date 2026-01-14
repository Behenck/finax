import type { FastifyInstance } from "fastify";
import { getMembers } from "./get-members";
import { removeMember } from "./remove-member";
import { updateMember } from "./update-member";

export async function memberRoutes(app: FastifyInstance) {
  await app.register(getMembers);
  await app.register(removeMember);
  await app.register(updateMember);
}