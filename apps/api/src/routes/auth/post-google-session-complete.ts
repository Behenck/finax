import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueAuthTokenPair } from "./google-session-helpers";

type GoogleCompleteCodePayload = {
	sub: string;
	purpose?: string;
};

export async function postGoogleSessionComplete(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().post("/sessions/google/complete", {
		schema: {
			tags: ["auth"],
			summary: "Complete Google OAuth sign-in",
			body: z.object({
				code: z.string().min(1),
			}),
			response: {
				200: z.object({
					accessToken: z.string(),
					refreshToken: z.string(),
				}),
				401: z.object({
					message: z.string(),
				}),
			},
		},
	}, async (request, reply) => {
		const { code } = request.body;

		let payload: GoogleCompleteCodePayload;
		try {
			payload = app.jwt.verify<GoogleCompleteCodePayload>(code);
		} catch {
			return reply.status(401).send({
				message: "Google authentication code is invalid or expired.",
			});
		}

		if (!payload.sub || payload.purpose !== "google_complete") {
			return reply.status(401).send({
				message: "Google authentication code is invalid.",
			});
		}

		const user = await prisma.user.findUnique({
			where: {
				id: payload.sub,
			},
			select: {
				id: true,
			},
		});

		if (!user) {
			return reply.status(401).send({
				message: "Google authentication code is invalid.",
			});
		}

		const tokenPair = await issueAuthTokenPair(reply, user.id);
		return reply.status(200).send(tokenPair);
	});
}
