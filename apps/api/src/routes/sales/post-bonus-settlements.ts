import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { handlePrismaError } from "../_errors/prisma-error";
import {
	calculateBonusSettlementPreview,
	getCurrentDateUtc,
	mapBonusInstallmentCreateManyData,
} from "./bonus-settlement-calculator";
import {
	parseSaleDateInput,
	PostBonusSettlementsBodySchema,
	PostBonusSettlementsResponseSchema,
} from "./sale-schemas";

export async function postBonusSettlements(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/commissions/bonus-settlements",
			{
				schema: {
					tags: ["sales"],
					summary: "Settle bonus scenarios for a closed period",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: PostBonusSettlementsBodySchema,
					response: {
						201: PostBonusSettlementsResponseSchema,
					},
				},
			},
			async (request, reply) => {
				const { slug } = request.params;
				const {
					productId,
					periodFrequency,
					periodYear,
					periodIndex,
					settledAt,
				} = request.body;
				const actorId = await request.getCurrentUserId();

				try {
					const { organization } = await request.getUserMembership(slug);
					const settledAtDate = settledAt
						? parseSaleDateInput(settledAt)
						: getCurrentDateUtc();

					const result = await db(() =>
						prisma.$transaction(async (tx) => {
							const calculation = await calculateBonusSettlementPreview({
								tx,
								organizationId: organization.id,
								productId,
								periodFrequency,
								periodYear,
								periodIndex,
								settledAtDate,
							});

							const settlement = await tx.bonusSettlement.create({
								data: {
									organizationId: organization.id,
									productId,
									periodFrequency,
									periodYear,
									periodIndex,
									settledById: actorId,
									settledAt: settledAtDate,
									winnersCount: calculation.winners.length,
								},
								select: {
									id: true,
								},
							});

							let resultsCount = 0;
							let installmentsCount = 0;

							for (const winner of calculation.winners) {
								const createdResult = await tx.bonusSettlementResult.create({
									data: {
										settlementId: settlement.id,
										scenarioId: winner.scenarioId,
										participantType: winner.participantType,
										beneficiaryCompanyId: winner.beneficiaryCompanyId,
										beneficiaryPartnerId: winner.beneficiaryPartnerId,
										beneficiarySellerId: winner.beneficiarySellerId,
										beneficiarySupervisorId: winner.beneficiarySupervisorId,
										beneficiaryLabel: winner.beneficiaryLabel,
										achievedAmount: winner.achievedAmount,
										targetAmount: winner.targetAmount,
										payoutEnabled: winner.payoutEnabled,
										payoutAmount: winner.payoutAmount,
									},
									select: {
										id: true,
									},
								});
								resultsCount += 1;

								if (!winner.payoutEnabled || winner.payoutInstallments.length === 0) {
									continue;
								}

								await tx.bonusInstallment.createMany({
									data: mapBonusInstallmentCreateManyData({
										organizationId: organization.id,
										settlementId: settlement.id,
										resultId: createdResult.id,
										productId,
										periodFrequency,
										periodYear,
										periodIndex,
										winner,
									}),
								});
								installmentsCount += winner.payoutInstallments.length;
							}

							return {
								settlementId: settlement.id,
								winnersCount: calculation.winners.length,
								resultsCount,
								installmentsCount,
							};
						}),
					);

					return reply.status(201).send(result);
				} catch (error) {
					handlePrismaError(error);
				}
			},
		);
}
