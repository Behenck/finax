import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	ProductCommissionCalculationBase,
	type ProductCommissionRecipientType,
	ProductCommissionScenarioConditionType,
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
	ReplaceProductCommissionScenariosBodySchema,
	toScaledPercentage,
} from "./commission-scenarios-schema";

const paramsSchema = z.object({
	slug: z.string(),
	id: z.uuid(),
});

function assertIdsFound({
	found,
	expected,
	errorMessage,
}: {
	found: number;
	expected: number;
	errorMessage: string;
}) {
	if (found !== expected) {
		throw new BadRequestError(errorMessage);
	}
}

export async function replaceProductCommissionScenarios(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/organizations/:slug/products/:id/commission-scenarios",
			{
				schema: {
					tags: ["products"],
					summary: "Replace product commission scenarios",
					security: [{ bearerAuth: [] }],
					params: paramsSchema,
					body: ReplaceProductCommissionScenariosBodySchema,
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

					for (const scenario of scenarios) {
						for (const [
							commissionIndex,
							commission,
						] of scenario.commissions.entries()) {
							const calculationBase =
								commission.calculationBase ?? "SALE_TOTAL";
							if (calculationBase !== "COMMISSION") {
								continue;
							}

							const baseCommissionIndex = commission.baseCommissionIndex;
							if (
								baseCommissionIndex === undefined ||
								baseCommissionIndex < 0 ||
								baseCommissionIndex >= scenario.commissions.length
							) {
								throw new BadRequestError(
									"Invalid base commission reference in scenario commissions",
								);
							}

							if (baseCommissionIndex === commissionIndex) {
								throw new BadRequestError(
									"A commission cannot reference itself as calculation base",
								);
							}

							const referencedCommission =
								scenario.commissions[baseCommissionIndex];
							const referencedCommissionCalculationBase =
								referencedCommission?.calculationBase ?? "SALE_TOTAL";

							if (
								!referencedCommission ||
								referencedCommissionCalculationBase !== "SALE_TOTAL"
							) {
								throw new BadRequestError(
									"Commission base must reference a SALE_TOTAL commission",
								);
							}
						}
					}

					const conditionCompanyIds = new Set<string>();
					const conditionPartnerIds = new Set<string>();
					const conditionUnitIds = new Set<string>();
					const conditionSellerIds = new Set<string>();

					const recipientCompanyIds = new Set<string>();
					const recipientUnitIds = new Set<string>();
					const recipientSellerIds = new Set<string>();
					const recipientSupervisorIds = new Set<string>();

					for (const scenario of scenarios) {
						for (const condition of scenario.conditions) {
							switch (condition.type) {
								case "COMPANY":
									if (condition.valueId) {
										conditionCompanyIds.add(condition.valueId);
									}
									break;
								case "PARTNER":
									if (condition.valueId) {
										conditionPartnerIds.add(condition.valueId);
									}
									break;
								case "UNIT":
									if (condition.valueId) {
										conditionUnitIds.add(condition.valueId);
									}
									break;
								case "SELLER":
									if (condition.valueId) {
										conditionSellerIds.add(condition.valueId);
									}
									break;
							}
						}

						for (const commission of scenario.commissions) {
							if (!commission.beneficiaryId) continue;

							switch (commission.recipientType) {
								case "COMPANY":
									recipientCompanyIds.add(commission.beneficiaryId);
									break;
								case "UNIT":
									recipientUnitIds.add(commission.beneficiaryId);
									break;
								case "SELLER":
									recipientSellerIds.add(commission.beneficiaryId);
									break;
								case "SUPERVISOR":
									recipientSupervisorIds.add(commission.beneficiaryId);
									break;
							}
						}
					}

					const companyIds = [
						...new Set([...conditionCompanyIds, ...recipientCompanyIds]),
					];
					const partnerIds = [...conditionPartnerIds];
					const unitIds = [
						...new Set([...conditionUnitIds, ...recipientUnitIds]),
					];
					const sellerIds = [
						...new Set([...conditionSellerIds, ...recipientSellerIds]),
					];
					const supervisorIds = [...recipientSupervisorIds];

					const companies = companyIds.length
						? await prisma.company.findMany({
								where: {
									organizationId: organization.id,
									id: {
										in: companyIds,
									},
								},
								select: {
									id: true,
									name: true,
								},
							})
						: [];
					assertIdsFound({
						found: companies.length,
						expected: companyIds.length,
						errorMessage: "One or more companies were not found",
					});
					const companyNameById = new Map(
						companies.map((company) => [company.id, company.name]),
					);

					const units = unitIds.length
						? await prisma.unit.findMany({
								where: {
									id: {
										in: unitIds,
									},
									company: {
										organizationId: organization.id,
									},
								},
								select: {
									id: true,
									name: true,
									company: {
										select: {
											name: true,
										},
									},
								},
							})
						: [];
					assertIdsFound({
						found: units.length,
						expected: unitIds.length,
						errorMessage: "One or more units were not found",
					});
					const unitNameById = new Map(
						units.map((unit) => [
							unit.id,
							`${unit.company.name} -> ${unit.name}`,
						]),
					);

					const sellers = sellerIds.length
						? await prisma.seller.findMany({
								where: {
									organizationId: organization.id,
									status: SellerStatus.ACTIVE,
									id: {
										in: sellerIds,
									},
								},
								select: {
									id: true,
									name: true,
								},
							})
						: [];
					assertIdsFound({
						found: sellers.length,
						expected: sellerIds.length,
						errorMessage: "One or more sellers were not found or are inactive",
					});
					const sellerNameById = new Map(
						sellers.map((seller) => [seller.id, seller.name]),
					);

					const partners = partnerIds.length
						? await prisma.partner.findMany({
								where: {
									organizationId: organization.id,
									id: {
										in: partnerIds,
									},
								},
								select: {
									id: true,
								},
							})
						: [];
					assertIdsFound({
						found: partners.length,
						expected: partnerIds.length,
						errorMessage: "One or more partners were not found",
					});

					const supervisors = supervisorIds.length
						? await prisma.member.findMany({
								where: {
									organizationId: organization.id,
									role: Role.SUPERVISOR,
									id: {
										in: supervisorIds,
									},
								},
								select: {
									id: true,
									user: {
										select: {
											name: true,
											email: true,
										},
									},
								},
							})
						: [];
					assertIdsFound({
						found: supervisors.length,
						expected: supervisorIds.length,
						errorMessage: "One or more supervisors were not found",
					});
					const supervisorNameById = new Map(
						supervisors.map((supervisor) => [
							supervisor.id,
							supervisor.user.name ?? supervisor.user.email,
						]),
					);

					await db(() =>
						prisma.$transaction(async (tx) => {
							const existingScenarios =
								await tx.productCommissionScenario.findMany({
									where: {
										productId: product.id,
									},
									select: {
										id: true,
									},
								});

							if (existingScenarios.length > 0) {
								const scenarioIds = existingScenarios.map(
									(scenario) => scenario.id,
								);
								const existingCommissions = await tx.productCommission.findMany(
									{
										where: {
											scenarioId: {
												in: scenarioIds,
											},
										},
										select: {
											id: true,
										},
									},
								);

								if (existingCommissions.length > 0) {
									await tx.productCommissionInstallment.deleteMany({
										where: {
											commissionId: {
												in: existingCommissions.map(
													(commission) => commission.id,
												),
											},
										},
									});
								}

								await tx.productCommission.deleteMany({
									where: {
										scenarioId: {
											in: scenarioIds,
										},
									},
								});
								await tx.productCommissionScenarioCondition.deleteMany({
									where: {
										scenarioId: {
											in: scenarioIds,
										},
									},
								});
								await tx.productCommissionScenario.deleteMany({
									where: {
										id: {
											in: scenarioIds,
										},
									},
								});
							}

							for (const [scenarioIndex, scenario] of scenarios.entries()) {
								const createdScenario =
									await tx.productCommissionScenario.create({
										data: {
											productId: product.id,
											name: scenario.name.trim(),
											description: null,
											isDefault: scenarioIndex === 0,
											isActive: true,
											sortOrder: scenarioIndex,
										},
										select: {
											id: true,
										},
									});

								if (scenario.conditions.length > 0) {
									await tx.productCommissionScenarioCondition.createMany({
										data: scenario.conditions.map(
											(condition, conditionIndex) => {
												switch (condition.type) {
													case "COMPANY":
														if (!condition.valueId) {
															return {
																scenarioId: createdScenario.id,
																type: ProductCommissionScenarioConditionType.SALE_HAS_COMPANY,
																sortOrder: conditionIndex,
															};
														}

														return {
															scenarioId: createdScenario.id,
															type: ProductCommissionScenarioConditionType.COMPANY_EQUALS,
															companyId: condition.valueId,
															sortOrder: conditionIndex,
														};
													case "PARTNER":
														if (!condition.valueId) {
															return {
																scenarioId: createdScenario.id,
																type: ProductCommissionScenarioConditionType.SALE_HAS_PARTNER,
																sortOrder: conditionIndex,
															};
														}

														return {
															scenarioId: createdScenario.id,
															type: ProductCommissionScenarioConditionType.PARTNER_EQUALS,
															partnerId: condition.valueId,
															sortOrder: conditionIndex,
														};
													case "UNIT":
														if (!condition.valueId) {
															return {
																scenarioId: createdScenario.id,
																type: ProductCommissionScenarioConditionType.SALE_HAS_UNIT,
																sortOrder: conditionIndex,
															};
														}

														return {
															scenarioId: createdScenario.id,
															type: ProductCommissionScenarioConditionType.SALE_UNIT_EQUALS,
															unitId: condition.valueId,
															sortOrder: conditionIndex,
														};
													case "SELLER":
														if (!condition.valueId) {
															return {
																scenarioId: createdScenario.id,
																type: ProductCommissionScenarioConditionType.SALE_HAS_SELLER,
																sortOrder: conditionIndex,
															};
														}

														return {
															scenarioId: createdScenario.id,
															type: ProductCommissionScenarioConditionType.SELLER_EQUALS,
															sellerId: condition.valueId,
															sortOrder: conditionIndex,
														};
													default:
														throw new BadRequestError("Invalid condition type");
												}
											},
										),
									});
								}

								const createdCommissionIdsBySortOrder: string[] = [];
								for (const [
									commissionIndex,
									commission,
								] of scenario.commissions.entries()) {
									const beneficiaryId = commission.beneficiaryId;
									const recipientType = commission.recipientType;

									const recipientCompanyId =
										recipientType === "COMPANY" ? beneficiaryId : null;
									const recipientUnitId =
										recipientType === "UNIT" ? beneficiaryId : null;
									const recipientSellerId =
										recipientType === "SELLER" ? beneficiaryId : null;
									const recipientSupervisorId =
										recipientType === "SUPERVISOR" ? beneficiaryId : null;
									const calculationBase =
										commission.calculationBase === "COMMISSION"
											? ProductCommissionCalculationBase.COMMISSION
											: ProductCommissionCalculationBase.SALE_TOTAL;

									const description =
										recipientType === "COMPANY" && recipientCompanyId
											? (companyNameById.get(recipientCompanyId) ?? "Empresa")
											: recipientType === "UNIT" && recipientUnitId
												? (unitNameById.get(recipientUnitId) ?? "Unidade")
												: recipientType === "SELLER" && recipientSellerId
													? (sellerNameById.get(recipientSellerId) ??
														"Vendedor")
													: recipientType === "SUPERVISOR" &&
															recipientSupervisorId
														? (supervisorNameById.get(recipientSupervisorId) ??
															"Supervisor")
														: recipientType === "COMPANY"
															? "Empresa vinculada"
														: recipientType === "PARTNER"
															? "Parceiro vinculado"
															: recipientType === "SELLER"
																? "Vendedor vinculado"
																: recipientType === "SUPERVISOR"
																	? "Supervisor vinculado"
																	: commission.beneficiaryLabel?.trim() ||
																		"Outro";

									const createdCommission = await tx.productCommission.create({
										data: {
											scenarioId: createdScenario.id,
											description,
											recipientType:
												recipientType as ProductCommissionRecipientType,
											calculationBase,
											baseCommissionId: null,
											recipientCompanyId,
											recipientUnitId,
											recipientSellerId,
											recipientSupervisorId,
											recipientOtherDescription:
												recipientType === "OTHER"
													? (commission.beneficiaryLabel?.trim() ?? null)
													: null,
											totalPercentage: toScaledPercentage(
												commission.totalPercentage,
											),
											sortOrder: commissionIndex,
										},
										select: {
											id: true,
										},
									});

									createdCommissionIdsBySortOrder[commissionIndex] =
										createdCommission.id;

									await tx.productCommissionInstallment.createMany({
										data: commission.installments.map((installment) => ({
											commissionId: createdCommission.id,
											installmentNumber: installment.installmentNumber,
											percentage: toScaledPercentage(installment.percentage),
										})),
									});
								}

								for (const [
									commissionIndex,
									commission,
								] of scenario.commissions.entries()) {
									if (commission.calculationBase !== "COMMISSION") {
										continue;
									}

									const baseCommissionIndex = commission.baseCommissionIndex;
									if (baseCommissionIndex === undefined) {
										continue;
									}

									const commissionId =
										createdCommissionIdsBySortOrder[commissionIndex];
									const baseCommissionId =
										createdCommissionIdsBySortOrder[baseCommissionIndex];

									if (!commissionId || !baseCommissionId) {
										throw new BadRequestError(
											"Invalid base commission reference in scenario commissions",
										);
									}

									await tx.productCommission.update({
										where: {
											id: commissionId,
										},
										data: {
											baseCommissionId,
										},
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
