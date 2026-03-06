import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { compare, hash } from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

const PatchMePasswordBodySchema = z.object({
	currentPassword: z.string().min(6),
	newPassword: z.string().min(6),
});

export async function patchMePassword(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/me/password",
			{
				schema: {
					tags: ["auth"],
					summary: "Update current user's password",
					security: [{ bearerAuth: [] }],
					body: PatchMePasswordBodySchema,
					response: {
						204: z.null(),
						400: z.object({
							message: z.string(),
						}),
					},
				},
			},
			async (request, reply) => {
				const userId = await request.getCurrentUserId();
				const { currentPassword, newPassword } = request.body;

				const user = await prisma.user.findUnique({
					where: {
						id: userId,
					},
					select: {
						id: true,
						passwordHash: true,
					},
				});

				if (!user) {
					return reply.status(400).send({
						message: "User not found.",
					});
				}

				if (!user.passwordHash) {
					return reply.status(400).send({
						message: "User does not have a local password.",
					});
				}

				const isCurrentPasswordValid = await compare(
					currentPassword,
					user.passwordHash,
				);

				if (!isCurrentPasswordValid) {
					return reply.status(400).send({
						message: "Current password is invalid.",
					});
				}

				const isSamePassword = await compare(newPassword, user.passwordHash);

				if (isSamePassword) {
					return reply.status(400).send({
						message: "New password must be different from current password.",
					});
				}

				const nextPasswordHash = await hash(newPassword, 6);

				await prisma.user.update({
					where: {
						id: userId,
					},
					data: {
						passwordHash: nextPasswordHash,
					},
				});

				return reply.status(204).send();
			},
		);
}
