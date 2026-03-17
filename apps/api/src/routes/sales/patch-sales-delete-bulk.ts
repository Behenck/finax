import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	PatchSalesDeleteBulkBodySchema,
	PatchSalesDeleteBulkResponseSchema,
} from "./sale-schemas";

export async function patchSalesDeleteBulk(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/organizations/:slug/sales/delete/bulk",
			{
				schema: {
					tags: ["sales"],
					summary: "Bulk delete sales",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: PatchSalesDeleteBulkBodySchema,
					response: {
						200: PatchSalesDeleteBulkResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { saleIds } = request.body;
				const { organization } = await request.getUserMembership(slug);

				const uniqueSaleIds = Array.from(new Set(saleIds));

				const sales = await prisma.sale.findMany({
					where: {
						organizationId: organization.id,
						id: {
							in: uniqueSaleIds,
						},
					},
					select: {
						id: true,
					},
				});

				if (sales.length !== uniqueSaleIds.length) {
					throw new BadRequestError("One or more sales were not found");
				}

				const deleted = await db(() =>
					prisma.$transaction(async (tx) => {
						const result = await tx.sale.deleteMany({
							where: {
								organizationId: organization.id,
								id: {
									in: uniqueSaleIds,
								},
							},
						});

						if (result.count !== uniqueSaleIds.length) {
							throw new BadRequestError("One or more sales were not found");
						}

						return result.count;
					}),
				);

				return {
					deleted,
				};
			},
		);
}
