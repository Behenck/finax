import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	ProductCommissionCalculationBase,
	ProductCommissionRecipientType,
	ProductCommissionScenarioConditionType,
} from "generated/prisma/enums";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { handlePrismaError } from "../_errors/prisma-error";
import {
	fromScaledPercentage,
	GetProductCommissionScenariosResponseSchema,
} from "./commission-scenarios-schema";

const paramsSchema = z.object({
	slug: z.string(),
	id: z.uuid(),
});

function mapCondition(condition: {
	type: ProductCommissionScenarioConditionType;
	companyId: string | null;
	partnerId: string | null;
	unitId: string | null;
	sellerId: string | null;
}) {
	switch (condition.type) {
		case ProductCommissionScenarioConditionType.COMPANY_EQUALS:
			if (!condition.companyId) return null;
			return {
				type: "COMPANY" as const,
				valueId: condition.companyId,
			};
		case ProductCommissionScenarioConditionType.SALE_HAS_COMPANY:
			return {
				type: "COMPANY" as const,
				valueId: null,
			};
		case ProductCommissionScenarioConditionType.PARTNER_EQUALS:
			if (!condition.partnerId) return null;
			return {
				type: "PARTNER" as const,
				valueId: condition.partnerId,
			};
		case ProductCommissionScenarioConditionType.SALE_HAS_PARTNER:
			return {
				type: "PARTNER" as const,
				valueId: null,
			};
		case ProductCommissionScenarioConditionType.SALE_HAS_SELLER:
			return {
				type: "SELLER" as const,
				valueId: null,
			};
		case ProductCommissionScenarioConditionType.SALE_HAS_UNIT:
			return {
				type: "UNIT" as const,
				valueId: null,
			};
		case ProductCommissionScenarioConditionType.SALE_UNIT_EQUALS:
			if (!condition.unitId) return null;
			return {
				type: "UNIT" as const,
				valueId: condition.unitId,
			};
		case ProductCommissionScenarioConditionType.SELLER_EQUALS:
			if (!condition.sellerId) return null;
			return {
				type: "SELLER" as const,
				valueId: condition.sellerId,
			};
		default:
			return null;
	}
}

function mapCommission(commission: {
	recipientType: ProductCommissionRecipientType;
	calculationBase: ProductCommissionCalculationBase;
	recipientCompanyId: string | null;
	recipientUnitId: string | null;
	recipientSellerId: string | null;
	recipientSupervisorId: string | null;
	recipientOtherDescription: string | null;
	baseCommission: {
		sortOrder: number;
	} | null;
	description: string;
	totalPercentage: number;
	installments: Array<{
		installmentNumber: number;
		percentage: number;
	}>;
}) {
	let recipientType:
		| "COMPANY"
		| "UNIT"
		| "PARTNER"
		| "SELLER"
		| "SUPERVISOR"
		| "OTHER" = "OTHER";
	let beneficiaryId: string | undefined;
	let beneficiaryLabel: string | undefined;

	switch (commission.recipientType) {
		case ProductCommissionRecipientType.COMPANY:
			recipientType = "COMPANY";
			if (commission.recipientCompanyId) {
				beneficiaryId = commission.recipientCompanyId;
			} else {
				beneficiaryLabel =
					commission.recipientOtherDescription ?? commission.description;
			}
			break;
		case ProductCommissionRecipientType.UNIT:
			recipientType = "UNIT";
			if (commission.recipientUnitId) {
				beneficiaryId = commission.recipientUnitId;
			} else {
				beneficiaryLabel =
					commission.recipientOtherDescription ?? commission.description;
			}
			break;
		case ProductCommissionRecipientType.SELLER:
			recipientType = "SELLER";
			if (commission.recipientSellerId) {
				beneficiaryId = commission.recipientSellerId;
			} else {
				beneficiaryLabel =
					commission.recipientOtherDescription ?? commission.description;
			}
			break;
		case ProductCommissionRecipientType.SUPERVISOR:
			recipientType = "SUPERVISOR";
			if (commission.recipientSupervisorId) {
				beneficiaryId = commission.recipientSupervisorId;
			} else {
				beneficiaryLabel =
					commission.recipientOtherDescription ?? commission.description;
			}
			break;
		case ProductCommissionRecipientType.PARTNER:
			recipientType = "PARTNER";
			beneficiaryLabel =
				commission.recipientOtherDescription ?? commission.description;
			break;
		case ProductCommissionRecipientType.OTHER:
			beneficiaryLabel =
				commission.recipientOtherDescription ?? commission.description;
			break;
	}

	const isCommissionBased =
		commission.calculationBase ===
			ProductCommissionCalculationBase.COMMISSION &&
		commission.baseCommission !== null;
	const calculationBase: "SALE_TOTAL" | "COMMISSION" = isCommissionBased
		? "COMMISSION"
		: "SALE_TOTAL";

	return {
		recipientType,
		beneficiaryId,
		beneficiaryLabel: beneficiaryLabel?.trim() || "Beneficiário",
		calculationBase,
		baseCommissionIndex: isCommissionBased
			? commission.baseCommission?.sortOrder
			: undefined,
		totalPercentage: fromScaledPercentage(commission.totalPercentage),
		installments: commission.installments.map((installment) => ({
			installmentNumber: installment.installmentNumber,
			percentage: fromScaledPercentage(installment.percentage),
		})),
	};
}

export async function getProductCommissionScenarios(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/products/:id/commission-scenarios",
			{
				schema: {
					tags: ["products"],
					summary: "Get product commission scenarios",
					security: [{ bearerAuth: [] }],
					params: paramsSchema,
					response: {
						200: GetProductCommissionScenariosResponseSchema,
					},
				},
			},
			async (request) => {
				try {
					const { slug, id } = request.params;

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

					const scenarios = await prisma.productCommissionScenario.findMany({
						where: {
							productId: id,
						},
						select: {
							name: true,
							conditions: {
								select: {
									type: true,
									companyId: true,
									partnerId: true,
									unitId: true,
									sellerId: true,
								},
								orderBy: {
									sortOrder: "asc",
								},
							},
							commissions: {
								select: {
									recipientType: true,
									calculationBase: true,
									baseCommission: {
										select: {
											sortOrder: true,
										},
									},
									recipientCompanyId: true,
									recipientUnitId: true,
									recipientSellerId: true,
									recipientSupervisorId: true,
									recipientOtherDescription: true,
									description: true,
									totalPercentage: true,
									installments: {
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
							},
						},
						orderBy: {
							sortOrder: "asc",
						},
					});

					return {
						scenarios: scenarios.map((scenario) => ({
							name: scenario.name,
							conditions: scenario.conditions
								.map(mapCondition)
								.filter((condition) => condition !== null),
							commissions: scenario.commissions.map(mapCommission),
						})),
					};
				} catch (error) {
					handlePrismaError(error);
				}
			},
		);
}
