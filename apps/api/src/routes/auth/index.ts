import type { FastifyInstance } from "fastify";
import { createAccount } from "./create-account";
import { authenticateWithPassword } from "./authenticate-with-password";
import { getProfile } from "./get-profile";
import { refreshTokenRoute } from "./refresh-token";
import { requestPasswordRecover } from "./request-password-recover";
import { resetPassword } from "./reset-password";

export async function authRoutes(app: FastifyInstance) {
  await app.register(createAccount);
  await app.register(authenticateWithPassword);
  await app.register(getProfile);
  await app.register(refreshTokenRoute);
  await app.register(requestPasswordRecover);
  await app.register(resetPassword);
}