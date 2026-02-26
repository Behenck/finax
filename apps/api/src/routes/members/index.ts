import type { FastifyInstance } from "fastify";
import { getMembers } from "./get-members";
import { removeMember } from "./remove-member";
import { updateMember } from "./update-member";
import { getMembersRole } from "./get-members-role";
import { updateMemberRole } from "./update-member-role";

export async function memberRoutes(app: FastifyInstance) {
  await app.register(getMembers);
  await app.register(getMembersRole);
  await app.register(removeMember);
  await app.register(updateMemberRole);
  await app.register(updateMember);
}
