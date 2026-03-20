import { auth } from "@/middleware/auth";
import { replaceMemberPermissionOverrides } from "@/permissions/service";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { PermissionOverrideEffect } from "generated/prisma/enums";
import z from "zod";

export async function putMemberPermissions(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/organizations/:slug/members/:memberId/permissions",
			{
				schema: {
					tags: ["permissions"],
					summary: "Replace member permission overrides",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						memberId: z.uuid(),
					}),
					body: z.object({
						overrides: z
							.array(
								z.object({
									permissionKey: z.string(),
									effect: z.enum(PermissionOverrideEffect),
								}),
							)
							.default([]),
					}),
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, memberId } = request.params;
				const { overrides } = request.body;
				await request.requirePermission(slug, "settings.permissions.manage");
				const actorUserId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				await replaceMemberPermissionOverrides({
					organizationId: organization.id,
					memberId,
					overrides,
					actorUserId,
				});

				return reply.status(204).send();
			},
		);
}
