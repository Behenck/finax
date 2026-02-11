import type { FastifyInstance } from "fastify";
import { createAccount } from "./create-account";
import { authenticateWithPassword } from "./authenticate-with-password";
import { refreshTokenRoute } from "./refresh-token";
import { requestPasswordRecover } from "./request-password-recover";
import { resetPassword } from "./reset-password";
import { sendEmailOTP } from "./send-email-otp";
import { verifyEmailOTP } from "./verify-email-otp";
import { getMe } from "./get-me";

export async function authRoutes(app: FastifyInstance) {
  await app.register(createAccount);
  await app.register(authenticateWithPassword);
  await app.register(getMe);
  await app.register(refreshTokenRoute);
  await app.register(requestPasswordRecover);
  await app.register(resetPassword);
  await app.register(sendEmailOTP);
  await app.register(verifyEmailOTP);
}