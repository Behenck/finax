import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	ProductBonusMetric,
	ProductBonusParticipantType,
	Role,
	SellerStatus,
} from "generated/prisma/enums";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { handlePrismaError } from "../_errors/prisma-error";
import {
	type ReplaceProductBonusScenariosBody,
	ReplaceProductBonusScenariosBodySchema,
	toScaledBonusPercentage,
} from "./bonus-scenarios-schema";

const paramsSchema = z.object({
	slug: z.string(),
	id: z.uuid(),
});

function assertIdsFound(params: {
	found: number;
	expected: number;
	errorMessage: string;
}) {
	if (params.found !== params.expected) {
		throw new BadRequestError(params.errorMessage);
	}
}

type BonusScenarioPayload = ReplaceProductBonusScenariosBody["scenarios"][number];

type PersistedBonusScenario = {
	id: string;
	name: string;
	metric: ProductBonusMetric;
	targetAmount: number;
	periodFrequency: string;
	payoutEnabled: boolean;
	payoutTotalPercentage: number | null;
	payoutDueDay: number | null;
	isActive: boolean;
	participants: Array<{
		type: ProductBonusParticipantType;
		companyId: string | null;
		partnerId: string | null;
		sellerId: string | null;
		supervisorId: string | null;
	}>;
	payoutInstallments: Array<{
		installmentNumber: number;
		percentage: number;
	}>;
};

function getPersistedParticipantValueId(
	participant: PersistedBonusScenario["participants"][number],
) {
	if (participant.type === ProductBonusParticipantType.COMPANY) {
		return participant.companyId;
	}

	if (participant.type === ProductBonusParticipantType.PARTNER) {
		return participant.partnerId;
	}

	if (participant.type === ProductBonusParticipantType.SELLER) {
		return participant.sellerId;
	}

	return participant.supervisorId;
}

function normalizeIncomingScenario(scenario: BonusScenarioPayload) {
	return {
		name: scenario.name.trim(),
		metric: scenario.metric ?? ProductBonusMetric.SALE_TOTAL,
		targetAmount: scenario.targetAmount,
		periodFrequency: scenario.periodFrequency,
		participants: scenario.participants.map((participant) => ({
			type: participant.type,
			valueId: participant.valueId,
		})),
		payoutEnabled: scenario.payoutEnabled,
		payoutTotalPercentage: scenario.payoutEnabled
			? toScaledBonusPercentage(scenario.payoutTotalPercentage ?? 0)
			: null,
		payoutDueDay: scenario.payoutEnabled ? (scenario.payoutDueDay ?? null) : null,
		payoutInstallments: scenario.payoutEnabled
			? scenario.payoutInstallments.map((installment) => ({
					installmentNumber: installment.installmentNumber,
					percentage: toScaledBonusPercentage(installment.percentage),
				}))
			: [],
	};
}

function normalizePersistedScenario(scenario: PersistedBonusScenario) {
	return {
		name: scenario.name.trim(),
		metric: scenario.metric,
		targetAmount: scenario.targetAmount,
		periodFrequency: scenario.periodFrequency,
		participants: scenario.participants.flatMap((participant) => {
			const valueId = getPersistedParticipantValueId(participant);

			if (!valueId) {
				return [];
			}

			return [
				{
					type: participant.type,
					valueId,
				},
			];
		}),
		payoutEnabled: scenario.payoutEnabled,
		payoutTotalPercentage: scenario.payoutEnabled
			? scenario.payoutTotalPercentage
			: null,
		payoutDueDay: scenario.payoutEnabled ? scenario.payoutDueDay : null,
		payoutInstallments: scenario.payoutEnabled
			? scenario.payoutInstallments.map((installment) => ({
					installmentNumber: installment.installmentNumber,
					percentage: installment.percentage,
				}))
			: [],
	};
}

function areBonusScenariosEquivalent(params: {
	incomingScenarios: BonusScenarioPayload[];
	persistedScenarios: PersistedBonusScenario[];
}) {
	const incomingNormalized = params.incomingScenarios.map(normalizeIncomingScenario);
	const persistedNormalized = params.persistedScenarios.map(
		normalizePersistedScenario,
	);

	return JSON.stringify(incomingNormalized) === JSON.stringify(persistedNormalized);
}

function getScenarioNameKey(name: string) {
	return name.trim().toLowerCase();
}

export async function replaceProductBonusScenarios(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/organizations/:slug/products/:id/bonus-scenarios",
			{
				schema: {
					tags: ["products"],
					summary: "Replace product bonus scenarios",
					security: [{ bearerAuth: [] }],
					params: paramsSchema,
					body: ReplaceProductBonusScenariosBodySchema,
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, id } = request.params;
				const { scenarios } = request.body;

				try {
					const organization = await prisma.organization.findUnique({
						where: { slug },
						select: { id: true },
					});

					if (!organization) {
						throw new BadRequestError("Organization not found");
					}

					const product = await prisma.product.findFirst({
						where: {
							id,
							organizationId: organization.id,
						},
						select: {
							id: true,
						},
					});

					if (!product) {
						throw new BadRequestError("Product not found");
					}

					const scenarioNameSet = new Set<string>();
					for (const scenario of scenarios) {
						const normalizedName = scenario.name.trim().toLowerCase();
						if (scenarioNameSet.has(normalizedName)) {
							throw new BadRequestError(
								"Scenario names must be unique within the product",
							);
						}
						scenarioNameSet.add(normalizedName);
					}

					const companyIds = new Set<string>();
					const partnerIds = new Set<string>();
					const sellerIds = new Set<string>();
					const supervisorIds = new Set<string>();

					for (const scenario of scenarios) {
						for (const participant of scenario.participants) {
							switch (participant.type) {
								case "COMPANY":
									companyIds.add(participant.valueId);
									break;
								case "PARTNER":
									partnerIds.add(participant.valueId);
									break;
								case "SELLER":
									sellerIds.add(participant.valueId);
									break;
								case "SUPERVISOR":
									supervisorIds.add(participant.valueId);
									break;
							}
						}
					}

					const [companies, partners, sellers, supervisors] = await Promise.all([
						companyIds.size
							? prisma.company.findMany({
									where: {
										organizationId: organization.id,
										id: {
											in: Array.from(companyIds),
										},
									},
									select: {
										id: true,
									},
								})
							: Promise.resolve([]),
						partnerIds.size
							? prisma.partner.findMany({
									where: {
										organizationId: organization.id,
										id: {
											in: Array.from(partnerIds),
										},
									},
									select: {
										id: true,
									},
								})
							: Promise.resolve([]),
						sellerIds.size
							? prisma.seller.findMany({
									where: {
										organizationId: organization.id,
										status: SellerStatus.ACTIVE,
										id: {
											in: Array.from(sellerIds),
										},
									},
									select: {
										id: true,
									},
								})
							: Promise.resolve([]),
						supervisorIds.size
							? prisma.member.findMany({
									where: {
										organizationId: organization.id,
										role: Role.SUPERVISOR,
										id: {
											in: Array.from(supervisorIds),
										},
									},
									select: {
										id: true,
									},
								})
							: Promise.resolve([]),
					]);

					assertIdsFound({
						found: companies.length,
						expected: companyIds.size,
						errorMessage: "One or more companies were not found",
					});
					assertIdsFound({
						found: partners.length,
						expected: partnerIds.size,
						errorMessage: "One or more partners were not found",
					});
					assertIdsFound({
						found: sellers.length,
						expected: sellerIds.size,
						errorMessage: "One or more sellers were not found or are inactive",
					});
					assertIdsFound({
						found: supervisors.length,
						expected: supervisorIds.size,
						errorMessage: "One or more supervisors were not found",
					});

					await db(() =>
						prisma.$transaction(async (tx) => {
							const existingScenarios = await tx.productBonusScenario.findMany({
								where: {
									productId: product.id,
								},
								select: {
									id: true,
									name: true,
									metric: true,
									targetAmount: true,
									periodFrequency: true,
									payoutEnabled: true,
									payoutTotalPercentage: true,
									payoutDueDay: true,
									isActive: true,
									participants: {
										select: {
											type: true,
											companyId: true,
											partnerId: true,
											sellerId: true,
											supervisorId: true,
										},
										orderBy: {
											sortOrder: "asc",
										},
									},
									payoutInstallments: {
										select: {
											installmentNumber: true,
											percentage: true,
										},
										orderBy: {
											installmentNumber: "asc",
										},
									},
								},
								orderBy: {
									sortOrder: "asc",
								},
							});

							const existingSettlementsCount = await tx.bonusSettlement.count({
								where: {
									organizationId: organization.id,
									productId: product.id,
								},
							});

							if (existingSettlementsCount > 0) {
								if (
									areBonusScenariosEquivalent({
										incomingScenarios: scenarios,
										persistedScenarios: existingScenarios.filter(
											(scenario) => scenario.isActive,
										),
									})
								) {
									return;
								}

								const existingScenarioByName = new Map(
									existingScenarios.map((scenario) => [
										getScenarioNameKey(scenario.name),
										scenario,
									]),
								);
								const incomingScenarioNameKeys = new Set<string>();

								for (const [scenarioIndex, scenario] of scenarios.entries()) {
									const scenarioNameKey = getScenarioNameKey(scenario.name);
									const existingScenario =
										existingScenarioByName.get(scenarioNameKey);
									incomingScenarioNameKeys.add(scenarioNameKey);

									const scenarioData = {
										name: scenario.name.trim(),
										metric:
											scenario.metric === "SALE_TOTAL"
												? ProductBonusMetric.SALE_TOTAL
												: ProductBonusMetric.SALE_TOTAL,
										targetAmount: scenario.targetAmount,
										periodFrequency: scenario.periodFrequency,
										payoutEnabled: scenario.payoutEnabled,
										payoutTotalPercentage: scenario.payoutEnabled
											? toScaledBonusPercentage(
														scenario.payoutTotalPercentage ?? 0,
												)
											: null,
										payoutDueDay: scenario.payoutEnabled
											? (scenario.payoutDueDay ?? null)
											: null,
										isActive: true,
										sortOrder: scenarioIndex,
									};

									const scenarioId = existingScenario
										? (
												await tx.productBonusScenario.update({
													where: {
														id: existingScenario.id,
													},
													data: scenarioData,
													select: {
														id: true,
													},
												})
											).id
										: (
												await tx.productBonusScenario.create({
													data: {
														productId: product.id,
														...scenarioData,
													},
													select: {
														id: true,
													},
												})
											).id;

									await tx.productBonusScenarioPayoutInstallment.deleteMany({
										where: {
											scenarioId,
										},
									});

									await tx.productBonusScenarioParticipant.deleteMany({
										where: {
											scenarioId,
										},
									});

									if (scenario.participants.length > 0) {
										await tx.productBonusScenarioParticipant.createMany({
											data: scenario.participants.map(
												(participant, participantIndex) => ({
													scenarioId,
													type: participant.type as ProductBonusParticipantType,
													companyId:
														participant.type === "COMPANY"
															? participant.valueId
															: null,
													partnerId:
														participant.type === "PARTNER"
															? participant.valueId
															: null,
													sellerId:
														participant.type === "SELLER"
															? participant.valueId
															: null,
													supervisorId:
														participant.type === "SUPERVISOR"
															? participant.valueId
															: null,
													sortOrder: participantIndex,
												}),
											),
										});
									}

									if (
										scenario.payoutEnabled &&
										scenario.payoutInstallments.length > 0
									) {
										await tx.productBonusScenarioPayoutInstallment.createMany({
											data: scenario.payoutInstallments.map((installment) => ({
												scenarioId,
												installmentNumber: installment.installmentNumber,
												percentage: toScaledBonusPercentage(
													installment.percentage,
												),
											})),
										});
									}
								}

								const scenarioIdsToDeactivate = existingScenarios
									.filter(
										(scenario) =>
											scenario.isActive &&
											!incomingScenarioNameKeys.has(
												getScenarioNameKey(scenario.name),
											),
									)
									.map((scenario) => scenario.id);

								if (scenarioIdsToDeactivate.length > 0) {
									await tx.productBonusScenario.updateMany({
										where: {
											id: {
												in: scenarioIdsToDeactivate,
											},
										},
										data: {
											isActive: false,
										},
									});
								}

								return;
							}

							if (existingScenarios.length > 0) {
								const scenarioIds = existingScenarios.map((scenario) => scenario.id);

								await tx.productBonusScenarioPayoutInstallment.deleteMany({
									where: {
										scenarioId: {
											in: scenarioIds,
										},
									},
								});

								await tx.productBonusScenarioParticipant.deleteMany({
									where: {
										scenarioId: {
											in: scenarioIds,
										},
									},
								});

								await tx.productBonusScenario.deleteMany({
									where: {
										id: {
											in: scenarioIds,
										},
									},
								});
							}

							for (const [scenarioIndex, scenario] of scenarios.entries()) {
								const createdScenario = await tx.productBonusScenario.create({
									data: {
										productId: product.id,
										name: scenario.name.trim(),
										metric:
											scenario.metric === "SALE_TOTAL"
												? ProductBonusMetric.SALE_TOTAL
												: ProductBonusMetric.SALE_TOTAL,
										targetAmount: scenario.targetAmount,
										periodFrequency: scenario.periodFrequency,
										payoutEnabled: scenario.payoutEnabled,
										payoutTotalPercentage: scenario.payoutEnabled
											? toScaledBonusPercentage(
														scenario.payoutTotalPercentage ?? 0,
												)
											: null,
										payoutDueDay: scenario.payoutEnabled
											? (scenario.payoutDueDay ?? null)
											: null,
										isActive: true,
										sortOrder: scenarioIndex,
									},
									select: {
										id: true,
									},
								});

								if (scenario.participants.length > 0) {
									await tx.productBonusScenarioParticipant.createMany({
										data: scenario.participants.map(
											(participant, participantIndex) => ({
												scenarioId: createdScenario.id,
												type: participant.type as ProductBonusParticipantType,
												companyId:
													participant.type === "COMPANY"
														? participant.valueId
														: null,
												partnerId:
													participant.type === "PARTNER"
														? participant.valueId
														: null,
												sellerId:
													participant.type === "SELLER"
														? participant.valueId
														: null,
												supervisorId:
													participant.type === "SUPERVISOR"
														? participant.valueId
														: null,
												sortOrder: participantIndex,
											}),
										),
									});
								}

								if (scenario.payoutEnabled && scenario.payoutInstallments.length > 0) {
									await tx.productBonusScenarioPayoutInstallment.createMany({
										data: scenario.payoutInstallments.map((installment) => ({
											scenarioId: createdScenario.id,
											installmentNumber: installment.installmentNumber,
											percentage: toScaledBonusPercentage(installment.percentage),
										})),
									});
								}
							}
						}),
					);

					return reply.status(204).send();
				} catch (error) {
					handlePrismaError(error);
				}
			},
		);
}
