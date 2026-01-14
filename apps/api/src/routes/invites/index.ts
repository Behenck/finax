import type { FastifyInstance } from "fastify";
import { acceptInvite } from "./accept-invite";
import { createInvite } from "./create-invite";
import { getInvites } from "./get-invites";
import { getPendingInvites } from "./get-pending-invites";
import { revokeInvite } from "./revoke-invite";
import { rejectInvite } from "./reject-invite";

export async function inviteRoutes(app: FastifyInstance) {
  await app.register(acceptInvite);
  await app.register(createInvite);
  await app.register(getInvites);
  await app.register(getPendingInvites);
  await app.register(revokeInvite);
  await app.register(rejectInvite);
}