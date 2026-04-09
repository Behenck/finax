import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { SaleHistoryAction } from "generated/prisma/enums";
import { BadRequestError } from "../_errors/bad-request-error";
import { assertSaleCanCreateDelinquency } from "./sale-delinquencies";
import { createSaleHistoryEvent } from "./sale-history";
import {
	CreateSaleDelinquencyBodySchema,
	parseSaleDateInput,
} from "./sale-schemas";

export async function postSaleDelinquency(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/sales/:saleId/delinquencies",
			{
				schema: {
					tags: ["sales"],
					summary: "Create sale delinquency",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
					}),
					body: CreateSaleDelinquencyBodySchema,
					response: {
						201: z.object({
							delinquencyId: z.uuid(),
						}),
					},
				},
			},
			async (request, reply) => {
				const { slug, saleId } = request.params;
				const { dueDate } = request.body;
				const actorId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);
				const parsedDueDate = parseSaleDateInput(dueDate);

				const createdDelinquency = await db(() =>
					prisma.$transaction(async (tx) => {
						await assertSaleCanCreateDelinquency(tx, {
							organizationId: organization.id,
							saleId,
							dueDate: parsedDueDate,
						});

						const delinquency = await tx.saleDelinquency.create({
							data: {
								saleId,
								organizationId: organization.id,
								dueDate: parsedDueDate,
								createdById: actorId,
							},
							select: {
								id: true,
							},
						});

						await createSaleHistoryEvent(tx, {
							saleId,
							organizationId: organization.id,
							actorId,
							action: SaleHistoryAction.DELINQUENCY_CREATED,
							changes: [
								{
									path: "delinquency.dueDate",
									before: null,
									after: dueDate,
								},
							],
						});

						return delinquency;
					}),
				);

				if (!createdDelinquency) {
					throw new BadRequestError("Could not create delinquency");
				}

				return reply.status(201).send({
					delinquencyId: createdDelinquency.id,
				});
			},
		);
}
