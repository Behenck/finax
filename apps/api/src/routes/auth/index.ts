import type { FastifyInstance } from "fastify";
import { createAccount } from "./create-account";
import { authenticateWithPassword } from "./authenticate-with-password";
import { refreshTokenRoute } from "./refresh-token";
import { requestPasswordRecover } from "./request-password-recover";
import { resetPassword } from "./reset-password";
import { sendEmailOTP } from "./send-email-otp";
import { verifyEmailOTP } from "./verify-email-otp";
import { getMe } from "./get-me";
import { patchMe } from "./patch-me";
import { patchMePassword } from "./patch-me-password";

export async function authRoutes(app: FastifyInstance) {
  await app.register(createAccount);
  await app.register(authenticateWithPassword);
  await app.register(getMe);
  await app.register(patchMe);
  await app.register(patchMePassword);
  await app.register(refreshTokenRoute);
  await app.register(requestPasswordRecover);
  await app.register(resetPassword);
  await app.register(sendEmailOTP);
  await app.register(verifyEmailOTP);
}
