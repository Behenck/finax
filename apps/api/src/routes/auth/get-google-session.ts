import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { resolveAppWebUrlFromRequest } from "./app-web-url";
import { buildGoogleAuthUrl } from "./google-oauth";
import { GOOGLE_OAUTH_STATE_PURPOSE, issueGoogleOAuthState } from "./google-oauth-state";
import { createGoogleStateCookie } from "./google-state-cookie";

export async function getGoogleSession(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().get("/sessions/google", {
		schema: {
			tags: ["auth"],
			summary: "Start Google OAuth sign-in",
			response: {
				302: z.null(),
				500: z.object({
					message: z.string(),
				}),
			},
		},
	}, async (request, reply) => {
		try {
			const appWebUrl = resolveAppWebUrlFromRequest(request) ?? undefined;
			const state = await issueGoogleOAuthState(reply, {
				purpose: GOOGLE_OAUTH_STATE_PURPOSE.SIGN_IN,
				appWebUrl,
			});
			const redirectUrl = buildGoogleAuthUrl({ state });

			reply.header("Set-Cookie", createGoogleStateCookie(state));
			return reply.redirect(redirectUrl);
		} catch (error) {
			request.log.error({ error }, "Failed to initialize Google OAuth session");
			return reply.status(500).send({
				message: "Google authentication is not configured.",
			});
		}
	});
}
