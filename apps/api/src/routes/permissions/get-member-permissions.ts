import { auth } from "@/middleware/auth";
import { getMemberPermissionDetails } from "@/permissions/service";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { PermissionOverrideEffect, Role } from "generated/prisma/enums";
import z from "zod";

export async function getMemberPermissions(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/members/:memberId/permissions",
			{
				schema: {
					tags: ["permissions"],
					summary: "Get effective permissions and overrides for a member",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						memberId: z.uuid(),
					}),
					response: {
						200: z.object({
							member: z.object({
								id: z.uuid(),
								userId: z.uuid(),
								role: z.enum(Role),
								name: z.string().nullable(),
								email: z.email(),
							}),
							presetPermissions: z.array(z.string()),
							overrides: z.array(
								z.object({
									permissionKey: z.string(),
									effect: z.enum(PermissionOverrideEffect),
								}),
							),
							effectivePermissions: z.array(z.string()),
						}),
					},
				},
			},
			async (request) => {
				const { slug, memberId } = request.params;
				await request.requirePermission(slug, "settings.permissions.manage");
				const { organization } = await request.getUserMembership(slug);

				return getMemberPermissionDetails({
					organizationId: organization.id,
					memberId,
				});
			},
		);
}
