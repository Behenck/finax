import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import {
	ProductBonusMetric,
	ProductBonusParticipantType,
	ProductBonusPeriodFrequency,
} from "generated/prisma/enums";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { handlePrismaError } from "../_errors/prisma-error";
import {
	fromScaledBonusPercentage,
	GetProductBonusScenariosResponseSchema,
} from "./bonus-scenarios-schema";

const paramsSchema = z.object({
	slug: z.string(),
	id: z.uuid(),
});

const querystringSchema = z.object({
	includeInherited: z.coerce.boolean().optional().default(false),
});

type ScenarioRecord = {
	id: string;
	name: string;
	metric: ProductBonusMetric;
	targetAmount: number;
	periodFrequency: ProductBonusPeriodFrequency;
	payoutEnabled: boolean;
	payoutTotalPercentage: number | null;
	payoutDueDay: number | null;
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

async function loadProductBasic(params: {
	organizationId: string;
	productId: string;
	prismaClient: Pick<Prisma.TransactionClient, "product">;
}) {
	return params.prismaClient.product.findFirst({
		where: {
			id: params.productId,
			organizationId: params.organizationId,
		},
		select: {
			id: true,
			parentId: true,
		},
	});
}

async function loadProductLocalBonusScenarios(params: {
	productId: string;
	prismaClient: Pick<Prisma.TransactionClient, "productBonusScenario">;
}) {
	return params.prismaClient.productBonusScenario.findMany({
		where: {
			productId: params.productId,
			isActive: true,
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
}

function mapParticipant(participant: {
	type: ProductBonusParticipantType;
	companyId: string | null;
	partnerId: string | null;
	sellerId: string | null;
	supervisorId: string | null;
}) {
	switch (participant.type) {
		case ProductBonusParticipantType.COMPANY:
			if (!participant.companyId) {
				return null;
			}
			return {
				type: "COMPANY" as const,
				valueId: participant.companyId,
			};
		case ProductBonusParticipantType.PARTNER:
			if (!participant.partnerId) {
				return null;
			}
			return {
				type: "PARTNER" as const,
				valueId: participant.partnerId,
			};
		case ProductBonusParticipantType.SELLER:
			if (!participant.sellerId) {
				return null;
			}
			return {
				type: "SELLER" as const,
				valueId: participant.sellerId,
			};
		case ProductBonusParticipantType.SUPERVISOR:
			if (!participant.supervisorId) {
				return null;
			}
			return {
				type: "SUPERVISOR" as const,
				valueId: participant.supervisorId,
			};
		default:
			return null;
	}
}

function mapScenario(scenario: ScenarioRecord) {
	return {
		name: scenario.name,
		metric: scenario.metric,
		targetAmount: scenario.targetAmount,
		periodFrequency: scenario.periodFrequency,
		participants: scenario.participants
			.map(mapParticipant)
			.filter((participant) => participant !== null),
		payoutEnabled: scenario.payoutEnabled,
		payoutTotalPercentage:
			scenario.payoutTotalPercentage === null
				? undefined
				: fromScaledBonusPercentage(scenario.payoutTotalPercentage),
		payoutDueDay: scenario.payoutDueDay ?? undefined,
		payoutInstallments: scenario.payoutInstallments.map((installment) => ({
			installmentNumber: installment.installmentNumber,
			percentage: fromScaledBonusPercentage(installment.percentage),
		})),
	};
}

export async function getProductBonusScenarios(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/products/:id/bonus-scenarios",
			{
				schema: {
					tags: ["products"],
					summary: "Get product bonus scenarios",
					security: [{ bearerAuth: [] }],
					params: paramsSchema,
					querystring: querystringSchema,
					response: {
						200: GetProductBonusScenariosResponseSchema,
					},
				},
			},
			async (request) => {
				try {
					const { slug, id } = request.params;
					const { includeInherited } = request.query;

					const organization = await prisma.organization.findUnique({
						where: { slug },
						select: { id: true },
					});

					if (!organization) {
						throw new BadRequestError("Organization not found");
					}

					const currentProduct = await loadProductBasic({
						organizationId: organization.id,
						productId: id,
						prismaClient: prisma,
					});

					if (!currentProduct) {
						throw new BadRequestError("Product not found");
					}

					const localScenarios = await loadProductLocalBonusScenarios({
						productId: currentProduct.id,
						prismaClient: prisma,
					});

					if (!includeInherited || localScenarios.length > 0) {
						return {
							scenarios: localScenarios.map(mapScenario),
						};
					}

					const visitedProductIds = new Set<string>([currentProduct.id]);
					let currentParentId = currentProduct.parentId;

					while (currentParentId) {
						if (visitedProductIds.has(currentParentId)) {
							break;
						}
						visitedProductIds.add(currentParentId);

						const parentProduct = await loadProductBasic({
							organizationId: organization.id,
							productId: currentParentId,
							prismaClient: prisma,
						});
						if (!parentProduct) {
							break;
						}

						const parentScenarios = await loadProductLocalBonusScenarios({
							productId: parentProduct.id,
							prismaClient: prisma,
						});
						if (parentScenarios.length > 0) {
							return {
								scenarios: parentScenarios.map(mapScenario),
							};
						}

						currentParentId = parentProduct.parentId;
					}

					return {
						scenarios: [],
					};
				} catch (error) {
					handlePrismaError(error);
				}
			},
		);
}
