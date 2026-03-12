import type { FastifyInstance, FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";

export const GOOGLE_OAUTH_STATE_PURPOSE = {
	SIGN_IN: "google_sign_in",
	LINK: "google_link",
	SYNC: "google_sync",
} as const;

export type GoogleOAuthStatePurpose =
	(typeof GOOGLE_OAUTH_STATE_PURPOSE)[keyof typeof GOOGLE_OAUTH_STATE_PURPOSE];

export type GoogleOAuthStatePayload = {
	purpose: GoogleOAuthStatePurpose;
	nonce: string;
	sub?: string;
	appWebUrl?: string;
};

export async function issueGoogleOAuthState(
	reply: FastifyReply,
	payload: {
		purpose: GoogleOAuthStatePurpose;
		sub?: string;
		appWebUrl?: string;
	},
) {
	return reply.jwtSign(
		{
			purpose: payload.purpose,
			nonce: randomUUID(),
			sub: payload.sub,
			appWebUrl: payload.appWebUrl,
		},
		{ expiresIn: "10m" },
	);
}

export function verifyGoogleOAuthState(app: FastifyInstance, state: string) {
	return app.jwt.verify<GoogleOAuthStatePayload>(state);
}
