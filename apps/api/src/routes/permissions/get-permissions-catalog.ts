import { auth } from "@/middleware/auth";
import { getPermissionCatalog } from "@/permissions/service";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export async function getPermissionsCatalog(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/permissions/catalog",
			{
				schema: {
					tags: ["permissions"],
					summary: "Get permissions catalog for organization",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					response: {
						200: z.object({
							permissions: z.array(
								z.object({
									id: z.uuid(),
									key: z.string(),
									module: z.string(),
									action: z.string(),
									description: z.string().nullable(),
									isActive: z.boolean(),
								}),
							),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				await request.requirePermission(slug, "settings.permissions.manage");
				await request.getUserMembership(slug);

				const permissions = await getPermissionCatalog();
				return {
					permissions,
				};
			},
		);
}
