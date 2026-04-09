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

export async function patchSaleDelinquencyResolve(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/organizations/:slug/sales/:saleId/delinquencies/:delinquencyId/resolve",
			{
				schema: {
					tags: ["sales"],
					summary: "Resolve sale delinquency",
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
				const resolvedAt = new Date();

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
								resolvedAt: true,
							},
						});

						if (!delinquency) {
							throw new BadRequestError("Sale delinquency not found");
						}

						if (delinquency.resolvedAt) {
							throw new BadRequestError("Sale delinquency already resolved");
						}

						await tx.saleDelinquency.update({
							where: {
								id: delinquency.id,
							},
							data: {
								resolvedAt,
								resolvedById: actorId,
							},
						});

						await createSaleHistoryEvent(tx, {
							saleId,
							organizationId: organization.id,
							actorId,
							action: SaleHistoryAction.DELINQUENCY_RESOLVED,
							changes: [
								{
									path: "delinquency.dueDate",
									before: null,
									after: toDateOnlyIso(delinquency.dueDate),
								},
								{
									path: "delinquency.resolvedAt",
									before: null,
									after: resolvedAt.toISOString(),
								},
							],
						});
					}),
				);

				return reply.status(204).send();
			},
		);
}
