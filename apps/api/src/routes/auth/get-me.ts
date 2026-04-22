import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { resolveEffectivePermissions } from "@/permissions/service";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { Role } from "generated/prisma/enums";

export async function getMe(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/me",
			{
				schema: {
					tags: ["auth"],
					summary: "Get current user's profile",
					security: [{ bearerAuth: [] }],
					response: {
						200: z.object({
							user: z.object({
								id: z.uuid(),
								name: z.string().nullable(),
								email: z.email(),
								avatarUrl: z.url().nullable(),
							}),
							organization: z.object({
								id: z.uuid(),
								memberId: z.uuid(),
								name: z.string(),
								slug: z.string(),
								role: z.enum(Role),
								ownerId: z.uuid(),
								enableSalesTransactionsSync: z.boolean(),
							}),
							effectivePermissions: z.array(z.string()),
						}),
					},
				},
			},
			async (req, reply) => {
				const userId = await req.getCurrentUserId();

				const user = await prisma.user.findUnique({
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true,
					},
					where: {
						id: userId,
					},
				});

				if (!user) {
					throw new BadRequestError("User not found.");
				}

				const membership = await prisma.member.findFirst({
					where: { userId },
					select: {
						id: true,
						userId: true,
						role: true,
						organization: {
							select: {
								id: true,
								name: true,
								slug: true,
								ownerId: true,
								enableSalesTransactionsSync: true,
							},
						},
					},
				});

				if (!membership) {
					throw new BadRequestError("Organization in User not found.");
				}

				const effectivePermissions = await resolveEffectivePermissions({
					organizationId: membership.organization.id,
					memberId: membership.id,
					role: membership.role,
					userId: membership.userId,
					ownerId: membership.organization.ownerId,
				});

				return reply.send({
					user,
					organization: {
						id: membership.organization.id,
						memberId: membership.id,
						name: membership.organization.name,
						slug: membership.organization.slug,
						ownerId: membership.organization.ownerId,
						enableSalesTransactionsSync:
							membership.organization.enableSalesTransactionsSync,
						role: membership.role,
					},
					effectivePermissions,
				});
			},
		);
}
