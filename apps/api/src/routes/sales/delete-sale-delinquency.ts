import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { SaleHistoryAction } from "generated/prisma/enums";
import { BadRequestError } from "../_errors/bad-request-error";
import { createSaleHistoryEvent } from "./sale-history";

function toDateOnlyIso(value: Date) {
	return value.toISOString().slice(0, 10);
}

export async function deleteSaleDelinquency(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.delete(
			"/organizations/:slug/sales/:saleId/delinquencies/:delinquencyId",
			{
				schema: {
					tags: ["sales"],
					summary: "Delete sale delinquency",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
						delinquencyId: z.uuid(),
					}),
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, saleId, delinquencyId } = request.params;
				const actorId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				await db(() =>
					prisma.$transaction(async (tx) => {
						const delinquency = await tx.saleDelinquency.findFirst({
							where: {
								id: delinquencyId,
								saleId,
								organizationId: organization.id,
							},
							select: {
								id: true,
								dueDate: true,
							},
						});

						if (!delinquency) {
							throw new BadRequestError("Sale delinquency not found");
						}

						await tx.saleDelinquency.delete({
							where: {
								id: delinquency.id,
							},
						});

						await createSaleHistoryEvent(tx, {
							saleId,
							organizationId: organization.id,
							actorId,
							action: SaleHistoryAction.DELINQUENCY_DELETED,
							changes: [
								{
									path: "delinquency.dueDate",
									before: toDateOnlyIso(delinquency.dueDate),
									after: null,
								},
							],
						});
					}),
				);

				return reply.status(204).send();
			},
		);
}
