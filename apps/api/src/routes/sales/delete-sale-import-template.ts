import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { assertRateLimit, saleImportRateLimit } from "./sale-import-rate-limit";

export async function deleteSaleImportTemplate(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.delete(
			"/organizations/:slug/sales/import-templates/:templateId",
			{
				schema: {
					tags: ["sales"],
					summary: "Delete sale import template",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						templateId: z.uuid(),
					}),
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, templateId } = request.params;
				const userId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				assertRateLimit(
					`${organization.id}:${userId}:sale-import-templates:delete`,
					saleImportRateLimit.templates,
				);

				const result = await prisma.saleImportTemplate.deleteMany({
					where: {
						id: templateId,
						organizationId: organization.id,
					},
				});

				if (result.count === 0) {
					throw new BadRequestError("Sale import template not found");
				}

				return reply.status(204).send();
			},
		);
}
