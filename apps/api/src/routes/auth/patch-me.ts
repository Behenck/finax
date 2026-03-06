import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

const PatchMeBodySchema = z.object({
	name: z.string().trim().min(2),
	avatarUrl: z.url().nullable().optional(),
});

const MeUserSchema = z.object({
	id: z.uuid(),
	name: z.string().nullable(),
	email: z.email(),
	avatarUrl: z.url().nullable(),
});

export async function patchMe(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().register(auth).patch("/me", {
		schema: {
			tags: ["auth"],
			summary: "Update current user's profile",
			security: [{ bearerAuth: [] }],
			body: PatchMeBodySchema,
			response: {
				200: z.object({
					user: MeUserSchema,
				}),
				400: z.object({
					message: z.string(),
				}),
			},
		},
	},
		async (request, reply) => {
			const userId = await request.getCurrentUserId();
			const { name, avatarUrl } = request.body;

			const currentUser = await prisma.user.findUnique({
				where: {
					id: userId,
				},
				select: {
					id: true,
				},
			});

			if (!currentUser) {
				return reply.status(400).send({
					message: "User not found.",
				});
			}

			const updatedUser = await prisma.user.update({
				where: {
					id: userId,
				},
				data: {
					name,
					avatarUrl: avatarUrl ?? null,
				},
				select: {
					id: true,
					name: true,
					email: true,
					avatarUrl: true,
				},
			});

			return reply.status(200).send({
				user: updatedUser,
			});
		});
}
