import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { AccountProvider } from "generated/prisma/enums";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

export async function getMeGoogleStatus(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().register(auth).get("/me/google/status", {
		schema: {
			tags: ["auth"],
			summary: "Get current user's Google account link status",
			security: [{ bearerAuth: [] }],
			response: {
				200: z.object({
					isLinked: z.boolean(),
				}),
			},
		},
	}, async (request, reply) => {
		const userId = await request.getCurrentUserId();

		const linkedAccount = await prisma.account.findFirst({
			where: {
				userId,
				provider: AccountProvider.GOOGLE,
			},
			select: {
				id: true,
			},
		});

		return reply.status(200).send({
			isLinked: Boolean(linkedAccount),
		});
	});
}
