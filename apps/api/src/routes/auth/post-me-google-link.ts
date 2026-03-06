import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { buildGoogleAuthUrl } from "./google-oauth";
import { GOOGLE_OAUTH_STATE_PURPOSE, issueGoogleOAuthState } from "./google-oauth-state";
import { createGoogleStateCookie } from "./google-state-cookie";

export async function postMeGoogleLink(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().register(auth).post("/me/google/link", {
		schema: {
			tags: ["auth"],
			summary: "Start Google account linking for current user",
			security: [{ bearerAuth: [] }],
			response: {
				200: z.object({
					authorizationUrl: z.url(),
				}),
				500: z.object({
					message: z.string(),
				}),
			},
		},
	}, async (request, reply) => {
		try {
			const userId = await request.getCurrentUserId();
			const state = await issueGoogleOAuthState(reply, {
				purpose: GOOGLE_OAUTH_STATE_PURPOSE.LINK,
				sub: userId,
			});

			const authorizationUrl = buildGoogleAuthUrl({ state });

			reply.header("Set-Cookie", createGoogleStateCookie(state));
			return reply.status(200).send({
				authorizationUrl,
			});
		} catch (error) {
			request.log.error({ error }, "Failed to initialize Google account linking");
			return reply.status(500).send({
				message: "Google authentication is not configured.",
			});
		}
	});
}
