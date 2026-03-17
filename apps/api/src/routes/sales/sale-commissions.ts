import { addMonths } from "date-fns";
import type { Prisma } from "generated/prisma/client";
import {
	PartnerStatus,
	Role,
	type SaleCommissionDirection,
	SaleCommissionInstallmentStatus,
	type SaleCommissionRecipientType,
	type SaleCommissionSourceType,
	SaleStatus,
	SellerStatus,
} from "generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	COMMISSION_PERCENTAGE_SCALE,
	fromScaledPercentage,
	parseSaleDateInput,
	type SaleCommissionInput,
	type SaleCommissionInstallmentStatusFilter,
	toScaledPercentage,
} from "./sale-schemas";

type ResolvedSaleCommission = {
	sourceType: SaleCommissionSourceType;
	recipientType: SaleCommissionRecipientType;
	direction: SaleCommissionDirection;
	beneficiaryCompanyId: string | null;
	beneficiaryUnitId: string | null;
	beneficiarySellerId: string | null;
	beneficiaryPartnerId: string | null;
	beneficiarySupervisorId: string | null;
	beneficiaryLabel: string | null;
	startDate: Date;
	totalPercentage: number;
	sortOrder: number;
	installments: Array<{
		installmentNumber: number;
		percentage: number;
		amount: number;
		status: SaleCommissionInstallmentStatus;
		expectedPaymentDate: Date;
		paymentDate: Date | null;
	}>;
};

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

const COMMISSION_AMOUNT_DENOMINATOR = BigInt(100 * COMMISSION_PERCENTAGE_SCALE);

function toScaledAmountFloor(totalAmount: number, percentageScaled: number) {
	const numerator = BigInt(totalAmount) * BigInt(percentageScaled);
	return Number(numerator / COMMISSION_AMOUNT_DENOMINATOR);
}

function toScaledAmountRounded(totalAmount: number, percentageScaled: number) {
	const numerator = BigInt(totalAmount) * BigInt(percentageScaled);
	return Number(
		(numerator + COMMISSION_AMOUNT_DENOMINATOR / 2n) /
			COMMISSION_AMOUNT_DENOMINATOR,
	);
}

function calculateInstallmentAmountsFromScaled({
	totalAmount,
	totalPercentageScaled,
	installmentPercentagesScaled,
}: {
	totalAmount: number;
	totalPercentageScaled: number;
	installmentPercentagesScaled: number[];
}) {
	if (installmentPercentagesScaled.length === 0) {
		return [];
	}

	const baseAmounts = installmentPercentagesScaled.map((percentageScaled) =>
		toScaledAmountFloor(totalAmount, percentageScaled),
	);
	const roundedCommissionTotal = toScaledAmountRounded(
		totalAmount,
		totalPercentageScaled,
	);
	const baseTotal = baseAmounts.reduce((sum, amount) => sum + amount, 0);
	const residual = roundedCommissionTotal - baseTotal;

	const lastInstallmentIndex = baseAmounts.length - 1;
	const lastInstallmentAmount =
		(baseAmounts[lastInstallmentIndex] ?? 0) + residual;

	if (lastInstallmentAmount < 0) {
		throw new BadRequestError("Invalid commission amount calculation");
	}

	return baseAmounts.map((amount, index) =>
		index === lastInstallmentIndex ? lastInstallmentAmount : amount,
	);
}

function resolveCommissionInstallmentExpectedPaymentDate(
	startDate: Date,
	installmentNumber: number,
) {
	return addMonths(startDate, Math.max(0, installmentNumber - 1));
}

export function deriveSaleCommissionDirectionFromRecipientType(
	recipientType: SaleCommissionRecipientType,
): SaleCommissionDirection {
	if (recipientType === "COMPANY" || recipientType === "UNIT") {
		return "INCOME";
	}

	return "OUTCOME";
}

export async function resolveSaleCommissionsData(
	organizationId: string,
	commissions: SaleCommissionInput[],
	saleTotalAmount: number,
) {
	const companyIds = new Set<string>();
	const unitIds = new Set<string>();
	const sellerIds = new Set<string>();
	const partnerIds = new Set<string>();
	const supervisorIds = new Set<string>();

	for (const commission of commissions) {
		if (!commission.beneficiaryId) {
			continue;
		}

		switch (commission.recipientType) {
			case "COMPANY":
				companyIds.add(commission.beneficiaryId);
				break;
			case "UNIT":
				unitIds.add(commission.beneficiaryId);
				break;
			case "SELLER":
				sellerIds.add(commission.beneficiaryId);
				break;
			case "PARTNER":
				partnerIds.add(commission.beneficiaryId);
				break;
			case "SUPERVISOR":
				supervisorIds.add(commission.beneficiaryId);
				break;
			case "OTHER":
				break;
		}
	}

	const [companies, units, sellers, partners, supervisors] = await Promise.all([
		companyIds.size
			? prisma.company.findMany({
					where: {
						organizationId,
						id: {
							in: Array.from(companyIds),
						},
					},
					select: {
						id: true,
						name: true,
					},
				})
			: Promise.resolve([]),
		unitIds.size
			? prisma.unit.findMany({
					where: {
						id: {
							in: Array.from(unitIds),
						},
						company: {
							organizationId,
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
			: Promise.resolve([]),
		sellerIds.size
			? prisma.seller.findMany({
					where: {
						organizationId,
						status: SellerStatus.ACTIVE,
						id: {
							in: Array.from(sellerIds),
						},
					},
					select: {
						id: true,
						name: true,
					},
				})
			: Promise.resolve([]),
		partnerIds.size
			? prisma.partner.findMany({
					where: {
						organizationId,
						status: PartnerStatus.ACTIVE,
						id: {
							in: Array.from(partnerIds),
						},
					},
					select: {
						id: true,
						name: true,
					},
				})
			: Promise.resolve([]),
		supervisorIds.size
			? prisma.member.findMany({
					where: {
						organizationId,
						role: Role.SUPERVISOR,
						id: {
							in: Array.from(supervisorIds),
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
			: Promise.resolve([]),
	]);

	assertIdsFound({
		found: companies.length,
		expected: companyIds.size,
		errorMessage: "One or more companies were not found",
	});
	assertIdsFound({
		found: units.length,
		expected: unitIds.size,
		errorMessage: "One or more units were not found",
	});
	assertIdsFound({
		found: sellers.length,
		expected: sellerIds.size,
		errorMessage: "One or more sellers were not found or are inactive",
	});
	assertIdsFound({
		found: partners.length,
		expected: partnerIds.size,
		errorMessage: "One or more partners were not found or are inactive",
	});
	assertIdsFound({
		found: supervisors.length,
		expected: supervisorIds.size,
		errorMessage: "One or more supervisors were not found",
	});

	const companyNameById = new Map(
		companies.map((company) => [company.id, company.name]),
	);
	const unitNameById = new Map(
		units.map((unit) => [unit.id, `${unit.company.name} -> ${unit.name}`]),
	);
	const sellerNameById = new Map(
		sellers.map((seller) => [seller.id, seller.name]),
	);
	const partnerNameById = new Map(
		partners.map((partner) => [partner.id, partner.name]),
	);
	const supervisorNameById = new Map(
		supervisors.map((supervisor) => [
			supervisor.id,
			supervisor.user.name ?? supervisor.user.email,
		]),
	);

	return commissions.map((commission, index): ResolvedSaleCommission => {
		const beneficiaryId = commission.beneficiaryId ?? null;
		const startDate = parseSaleDateInput(commission.startDate);
		const direction =
			commission.direction ??
			deriveSaleCommissionDirectionFromRecipientType(commission.recipientType);
		const totalPercentageScaled = toScaledPercentage(
			commission.totalPercentage,
		);
		const installmentPercentagesScaled = commission.installments.map(
			(installment) => toScaledPercentage(installment.percentage),
		);
		const installmentAmounts = calculateInstallmentAmountsFromScaled({
			totalAmount: saleTotalAmount,
			totalPercentageScaled,
			installmentPercentagesScaled,
		});

		const beneficiaryCompanyId =
			commission.recipientType === "COMPANY" ? beneficiaryId : null;
		const beneficiaryUnitId =
			commission.recipientType === "UNIT" ? beneficiaryId : null;
		const beneficiarySellerId =
			commission.recipientType === "SELLER" ? beneficiaryId : null;
		const beneficiaryPartnerId =
			commission.recipientType === "PARTNER" ? beneficiaryId : null;
		const beneficiarySupervisorId =
			commission.recipientType === "SUPERVISOR" ? beneficiaryId : null;

		const beneficiaryLabel =
			commission.recipientType === "COMPANY" && beneficiaryCompanyId
				? (companyNameById.get(beneficiaryCompanyId) ?? "Empresa")
				: commission.recipientType === "UNIT" && beneficiaryUnitId
					? (unitNameById.get(beneficiaryUnitId) ?? "Unidade")
					: commission.recipientType === "SELLER" && beneficiarySellerId
						? (sellerNameById.get(beneficiarySellerId) ?? "Vendedor")
						: commission.recipientType === "PARTNER" && beneficiaryPartnerId
							? (partnerNameById.get(beneficiaryPartnerId) ?? "Parceiro")
							: commission.recipientType === "SUPERVISOR" &&
									beneficiarySupervisorId
								? (supervisorNameById.get(beneficiarySupervisorId) ??
									"Supervisor")
								: (commission.beneficiaryLabel?.trim() ?? "Outro");

		return {
			sourceType: commission.sourceType,
			recipientType: commission.recipientType,
			direction,
			beneficiaryCompanyId,
			beneficiaryUnitId,
			beneficiarySellerId,
			beneficiaryPartnerId,
			beneficiarySupervisorId,
			beneficiaryLabel,
			startDate,
			totalPercentage: totalPercentageScaled,
			sortOrder: index,
			installments: commission.installments.map(
				(installment, installmentIndex) => ({
					installmentNumber: installment.installmentNumber,
					percentage: toScaledPercentage(installment.percentage),
					amount: installmentAmounts[installmentIndex] ?? 0,
					status: SaleCommissionInstallmentStatus.PENDING,
					expectedPaymentDate: resolveCommissionInstallmentExpectedPaymentDate(
						startDate,
						installment.installmentNumber,
					),
					paymentDate: null,
				}),
			),
		};
	});
}

export async function replaceSaleCommissions(
	tx: Prisma.TransactionClient,
	saleId: string,
	commissions: ResolvedSaleCommission[],
) {
	await tx.saleCommission.deleteMany({
		where: {
			saleId,
		},
	});

	for (const commission of commissions) {
		await tx.saleCommission.create({
			data: {
				saleId,
				sourceType: commission.sourceType,
				recipientType: commission.recipientType,
				direction: commission.direction,
				beneficiaryCompanyId: commission.beneficiaryCompanyId,
				beneficiaryUnitId: commission.beneficiaryUnitId,
				beneficiarySellerId: commission.beneficiarySellerId,
				beneficiaryPartnerId: commission.beneficiaryPartnerId,
				beneficiarySupervisorId: commission.beneficiarySupervisorId,
				beneficiaryLabel: commission.beneficiaryLabel,
				startDate: commission.startDate,
				totalPercentage: commission.totalPercentage,
				sortOrder: commission.sortOrder,
				installments: {
					create: commission.installments.map((installment) => ({
						installmentNumber: installment.installmentNumber,
						percentage: installment.percentage,
						amount: installment.amount,
						status: installment.status,
						expectedPaymentDate: installment.expectedPaymentDate,
						paymentDate: installment.paymentDate,
					})),
				},
			},
		});
	}
}

export async function recalculatePersistedSaleCommissionsAmounts(
	tx: Prisma.TransactionClient,
	saleId: string,
	saleTotalAmount: number,
) {
	const commissions = await tx.saleCommission.findMany({
		where: {
			saleId,
		},
		orderBy: {
			sortOrder: "asc",
		},
		select: {
			id: true,
			totalPercentage: true,
			installments: {
				orderBy: {
					installmentNumber: "asc",
				},
				select: {
					id: true,
					percentage: true,
				},
			},
		},
	});

	for (const commission of commissions) {
		if (commission.installments.length === 0) {
			continue;
		}

		const installmentAmounts = calculateInstallmentAmountsFromScaled({
			totalAmount: saleTotalAmount,
			totalPercentageScaled: commission.totalPercentage,
			installmentPercentagesScaled: commission.installments.map(
				(installment) => installment.percentage,
			),
		});

		for (const [index, installment] of commission.installments.entries()) {
			await tx.saleCommissionInstallment.update({
				where: {
					id: installment.id,
				},
				data: {
					amount: installmentAmounts[index] ?? 0,
				},
			});
		}
	}
}

export async function syncSaleCommissionTotalPercentage(
	tx: Prisma.TransactionClient,
	saleCommissionId: string,
) {
	const commissionInstallments = await tx.saleCommissionInstallment.findMany({
		where: {
			saleCommissionId,
		},
		select: {
			percentage: true,
		},
	});

	if (commissionInstallments.length === 0) {
		throw new BadRequestError("Cannot leave a commission without installments");
	}

	const nextTotalPercentage = commissionInstallments.reduce(
		(sum, installment) => sum + installment.percentage,
		0,
	);

	if (nextTotalPercentage <= 0) {
		throw new BadRequestError(
			"Commission total percentage must be greater than zero",
		);
	}

	await tx.saleCommission.update({
		where: {
			id: saleCommissionId,
		},
		data: {
			totalPercentage: nextTotalPercentage,
		},
	});
}

export async function renumberSaleCommissionInstallments(
	tx: Prisma.TransactionClient,
	saleCommissionId: string,
) {
	const installments = await tx.saleCommissionInstallment.findMany({
		where: {
			saleCommissionId,
		},
		orderBy: [
			{ installmentNumber: "asc" },
			{ createdAt: "asc" },
			{ id: "asc" },
		],
		select: {
			id: true,
			installmentNumber: true,
		},
	});

	for (const [index, installment] of installments.entries()) {
		const nextInstallmentNumber = index + 1;

		if (installment.installmentNumber === nextInstallmentNumber) {
			continue;
		}

		await tx.saleCommissionInstallment.update({
			where: {
				id: installment.id,
			},
			data: {
				installmentNumber: nextInstallmentNumber,
			},
		});
	}
}

function resolveSaleCommissionBeneficiaryId(commission: {
	recipientType: SaleCommissionRecipientType;
	beneficiaryCompanyId: string | null;
	beneficiaryUnitId: string | null;
	beneficiarySellerId: string | null;
	beneficiaryPartnerId: string | null;
	beneficiarySupervisorId: string | null;
}) {
	switch (commission.recipientType) {
		case "COMPANY":
			return commission.beneficiaryCompanyId;
		case "UNIT":
			return commission.beneficiaryUnitId;
		case "SELLER":
			return commission.beneficiarySellerId;
		case "PARTNER":
			return commission.beneficiaryPartnerId;
		case "SUPERVISOR":
			return commission.beneficiarySupervisorId;
		case "OTHER":
			return null;
	}
}

function resolveSaleCommissionBeneficiaryKey({
	saleCommissionId,
	recipientType,
	beneficiaryId,
	beneficiaryLabel,
}: {
	saleCommissionId: string;
	recipientType: SaleCommissionRecipientType;
	beneficiaryId: string | null;
	beneficiaryLabel: string | null;
}) {
	if (beneficiaryId) {
		return `${recipientType}:${beneficiaryId}`;
	}

	if (recipientType === "OTHER") {
		const normalizedLabel = beneficiaryLabel?.trim().toLowerCase();
		return normalizedLabel
			? `${recipientType}:${normalizedLabel}`
			: `${recipientType}:${saleCommissionId}`;
	}

	return `${recipientType}:${saleCommissionId}`;
}

function resolveSaleCommissionBeneficiaryLabel(commission: {
	recipientType: SaleCommissionRecipientType;
	beneficiaryLabel: string | null;
	beneficiaryCompany: { name: string } | null;
	beneficiaryUnit: { name: string; company: { name: string } } | null;
	beneficiarySeller: { name: string } | null;
	beneficiaryPartner: { name: string } | null;
	beneficiarySupervisor: {
		user: { name: string | null; email: string };
	} | null;
}) {
	if (commission.beneficiaryLabel?.trim()) {
		return commission.beneficiaryLabel.trim();
	}

	switch (commission.recipientType) {
		case "COMPANY":
			return commission.beneficiaryCompany?.name ?? null;
		case "UNIT":
			return commission.beneficiaryUnit
				? `${commission.beneficiaryUnit.company.name} -> ${commission.beneficiaryUnit.name}`
				: null;
		case "SELLER":
			return commission.beneficiarySeller?.name ?? null;
		case "PARTNER":
			return commission.beneficiaryPartner?.name ?? null;
		case "SUPERVISOR":
			return commission.beneficiarySupervisor
				? (commission.beneficiarySupervisor.user.name ??
						commission.beneficiarySupervisor.user.email)
				: null;
		case "OTHER":
			return null;
	}
}

export async function loadSaleCommissions(
	saleId: string,
	organizationId: string,
) {
	const commissions = await prisma.saleCommission.findMany({
		where: {
			saleId,
			sale: {
				organizationId,
			},
		},
		orderBy: {
			sortOrder: "asc",
		},
		select: {
			id: true,
			sourceType: true,
			recipientType: true,
			direction: true,
			beneficiaryCompanyId: true,
			beneficiaryUnitId: true,
			beneficiarySellerId: true,
			beneficiaryPartnerId: true,
			beneficiarySupervisorId: true,
			beneficiaryLabel: true,
			startDate: true,
			totalPercentage: true,
			sortOrder: true,
			beneficiaryCompany: {
				select: {
					name: true,
				},
			},
			beneficiaryUnit: {
				select: {
					name: true,
					company: {
						select: {
							name: true,
						},
					},
				},
			},
			beneficiarySeller: {
				select: {
					name: true,
				},
			},
			beneficiaryPartner: {
				select: {
					name: true,
				},
			},
			beneficiarySupervisor: {
				select: {
					user: {
						select: {
							name: true,
							email: true,
						},
					},
				},
			},
			installments: {
				select: {
					installmentNumber: true,
					percentage: true,
					amount: true,
					status: true,
					expectedPaymentDate: true,
					paymentDate: true,
				},
				orderBy: {
					installmentNumber: "asc",
				},
			},
		},
	});

	return commissions.map((commission) => {
		const installments = commission.installments.map((installment) => ({
			installmentNumber: installment.installmentNumber,
			percentage: fromScaledPercentage(installment.percentage),
			amount: installment.amount,
			status: installment.status,
			expectedPaymentDate: installment.expectedPaymentDate,
			paymentDate: installment.paymentDate,
		}));

		return {
			id: commission.id,
			sourceType: commission.sourceType,
			recipientType: commission.recipientType,
			direction: commission.direction,
			beneficiaryId: resolveSaleCommissionBeneficiaryId(commission),
			beneficiaryLabel: resolveSaleCommissionBeneficiaryLabel(commission),
			startDate: commission.startDate,
			totalPercentage: fromScaledPercentage(commission.totalPercentage),
			totalAmount: installments.reduce(
				(sum, installment) => sum + installment.amount,
				0,
			),
			sortOrder: commission.sortOrder,
			installments,
		};
	});
}

export async function loadSaleCommissionInstallments(
	saleId: string,
	organizationId: string,
) {
	const installments = await prisma.saleCommissionInstallment.findMany({
		where: {
			saleCommission: {
				saleId,
				sale: {
					organizationId,
				},
			},
		},
		orderBy: [
			{
				saleCommission: {
					sortOrder: "asc",
				},
			},
			{
				installmentNumber: "asc",
			},
		],
		select: {
			id: true,
			saleCommissionId: true,
			installmentNumber: true,
			percentage: true,
			amount: true,
			status: true,
			expectedPaymentDate: true,
			paymentDate: true,
			saleCommission: {
				select: {
					recipientType: true,
					sourceType: true,
					direction: true,
					beneficiaryCompanyId: true,
					beneficiaryUnitId: true,
					beneficiarySellerId: true,
					beneficiaryPartnerId: true,
					beneficiarySupervisorId: true,
					beneficiaryLabel: true,
					beneficiaryCompany: {
						select: {
							name: true,
						},
					},
					beneficiaryUnit: {
						select: {
							name: true,
							company: {
								select: {
									name: true,
								},
							},
						},
					},
					beneficiarySeller: {
						select: {
							name: true,
						},
					},
					beneficiaryPartner: {
						select: {
							name: true,
						},
					},
					beneficiarySupervisor: {
						select: {
							user: {
								select: {
									name: true,
									email: true,
								},
							},
						},
					},
				},
			},
		},
	});

	return installments.map((installment) => {
		const beneficiaryId = resolveSaleCommissionBeneficiaryId({
			recipientType: installment.saleCommission.recipientType,
			beneficiaryCompanyId: installment.saleCommission.beneficiaryCompanyId,
			beneficiaryUnitId: installment.saleCommission.beneficiaryUnitId,
			beneficiarySellerId: installment.saleCommission.beneficiarySellerId,
			beneficiaryPartnerId: installment.saleCommission.beneficiaryPartnerId,
			beneficiarySupervisorId:
				installment.saleCommission.beneficiarySupervisorId,
		});
		const beneficiaryLabel = resolveSaleCommissionBeneficiaryLabel({
			recipientType: installment.saleCommission.recipientType,
			beneficiaryLabel: installment.saleCommission.beneficiaryLabel,
			beneficiaryCompany: installment.saleCommission.beneficiaryCompany,
			beneficiaryUnit: installment.saleCommission.beneficiaryUnit,
			beneficiarySeller: installment.saleCommission.beneficiarySeller,
			beneficiaryPartner: installment.saleCommission.beneficiaryPartner,
			beneficiarySupervisor: installment.saleCommission.beneficiarySupervisor,
		});

		return {
			id: installment.id,
			saleCommissionId: installment.saleCommissionId,
			recipientType: installment.saleCommission.recipientType,
			sourceType: installment.saleCommission.sourceType,
			direction: installment.saleCommission.direction,
			beneficiaryId,
			beneficiaryKey: resolveSaleCommissionBeneficiaryKey({
				saleCommissionId: installment.saleCommissionId,
				recipientType: installment.saleCommission.recipientType,
				beneficiaryId,
				beneficiaryLabel,
			}),
			beneficiaryLabel,
			installmentNumber: installment.installmentNumber,
			percentage: fromScaledPercentage(installment.percentage),
			amount: installment.amount,
			status: installment.status,
			expectedPaymentDate: installment.expectedPaymentDate,
			paymentDate: installment.paymentDate,
		};
	});
}

type OrganizationCommissionInstallmentsFilters = {
	organizationId: string;
	q: string;
	productId?: string;
	status: SaleCommissionInstallmentStatusFilter;
	expectedFrom?: Date;
	expectedTo?: Date;
	direction?: SaleCommissionDirection;
};

const saleCommissionDirections = ["INCOME", "OUTCOME"] as const;

function buildOrganizationCommissionInstallmentsWhere({
	organizationId,
	q,
	productId,
	status,
	expectedFrom,
	expectedTo,
	direction,
	statusOverride,
}: OrganizationCommissionInstallmentsFilters & {
	statusOverride?: SaleCommissionInstallmentStatus;
}): Prisma.SaleCommissionInstallmentWhereInput {
	const searchTerm = q.trim();
	const andConditions: Prisma.SaleCommissionInstallmentWhereInput[] = [
		{
			saleCommission: {
				sale: {
					organizationId,
					status: SaleStatus.COMPLETED,
				},
			},
		},
	];

	if (direction) {
		andConditions.push({
			saleCommission: {
				direction,
			},
		});
	}

	if (productId) {
		andConditions.push({
			saleCommission: {
				sale: {
					productId,
				},
			},
		});
	}

	const requestedStatus = status === "ALL" ? undefined : status;

	if (statusOverride) {
		if (requestedStatus && requestedStatus !== statusOverride) {
			andConditions.push({
				status: {
					in: [] as SaleCommissionInstallmentStatus[],
				},
			});
		} else {
			andConditions.push({
				status: statusOverride,
			});
		}
	} else if (requestedStatus) {
		andConditions.push({
			status: requestedStatus,
		});
	}

	if (expectedFrom || expectedTo) {
		andConditions.push({
			expectedPaymentDate: {
				gte: expectedFrom,
				lte: expectedTo,
			},
		});
	}

	if (searchTerm) {
		andConditions.push({
			OR: [
				{
					saleCommission: {
						sale: {
							customer: {
								name: {
									contains: searchTerm,
									mode: "insensitive",
								},
							},
						},
					},
				},
				{
					saleCommission: {
						sale: {
							product: {
								name: {
									contains: searchTerm,
									mode: "insensitive",
								},
							},
						},
					},
				},
				{
					saleCommission: {
						sale: {
							company: {
								name: {
									contains: searchTerm,
									mode: "insensitive",
								},
							},
						},
					},
				},
				{
					saleCommission: {
						sale: {
							unit: {
								name: {
									contains: searchTerm,
									mode: "insensitive",
								},
							},
						},
					},
				},
				{
					saleCommission: {
						beneficiaryLabel: {
							contains: searchTerm,
							mode: "insensitive",
						},
					},
				},
				{
					saleCommission: {
						beneficiaryCompany: {
							name: {
								contains: searchTerm,
								mode: "insensitive",
							},
						},
					},
				},
				{
					saleCommission: {
						beneficiaryUnit: {
							name: {
								contains: searchTerm,
								mode: "insensitive",
							},
						},
					},
				},
				{
					saleCommission: {
						beneficiarySeller: {
							name: {
								contains: searchTerm,
								mode: "insensitive",
							},
						},
					},
				},
				{
					saleCommission: {
						beneficiaryPartner: {
							name: {
								contains: searchTerm,
								mode: "insensitive",
							},
						},
					},
				},
				{
					saleCommission: {
						beneficiarySupervisor: {
							user: {
								OR: [
									{
										name: {
											contains: searchTerm,
											mode: "insensitive",
										},
									},
									{
										email: {
											contains: searchTerm,
											mode: "insensitive",
										},
									},
								],
							},
						},
					},
				},
			],
		});
	}

	if (andConditions.length === 1) {
		return andConditions[0] as Prisma.SaleCommissionInstallmentWhereInput;
	}

	return {
		AND: andConditions,
	};
}

type InstallmentSummaryBucket = {
	count: number;
	amount: number;
};

type InstallmentDirectionSummary = {
	total: InstallmentSummaryBucket;
	pending: InstallmentSummaryBucket;
	paid: InstallmentSummaryBucket;
	canceled: InstallmentSummaryBucket;
};

type InstallmentSummaryByDirection = Record<
	SaleCommissionDirection,
	InstallmentDirectionSummary
>;

function toInstallmentSummaryBucket(aggregate: {
	_count: { _all: number };
	_sum: { amount: number | null };
}): InstallmentSummaryBucket {
	return {
		count: aggregate._count._all,
		amount: aggregate._sum.amount ?? 0,
	};
}

export async function loadOrganizationInstallmentsSummaryByDirection(
	filters: OrganizationCommissionInstallmentsFilters,
): Promise<InstallmentSummaryByDirection> {
	const summaries = await Promise.all(
		saleCommissionDirections.map(async (direction) => {
			const [total, pending, paid, canceled] = await Promise.all([
				prisma.saleCommissionInstallment.aggregate({
					where: buildOrganizationCommissionInstallmentsWhere({
						...filters,
						direction,
					}),
					_count: {
						_all: true,
					},
					_sum: {
						amount: true,
					},
				}),
				prisma.saleCommissionInstallment.aggregate({
					where: buildOrganizationCommissionInstallmentsWhere({
						...filters,
						direction,
						statusOverride: SaleCommissionInstallmentStatus.PENDING,
					}),
					_count: {
						_all: true,
					},
					_sum: {
						amount: true,
					},
				}),
				prisma.saleCommissionInstallment.aggregate({
					where: buildOrganizationCommissionInstallmentsWhere({
						...filters,
						direction,
						statusOverride: SaleCommissionInstallmentStatus.PAID,
					}),
					_count: {
						_all: true,
					},
					_sum: {
						amount: true,
					},
				}),
				prisma.saleCommissionInstallment.aggregate({
					where: buildOrganizationCommissionInstallmentsWhere({
						...filters,
						direction,
						statusOverride: SaleCommissionInstallmentStatus.CANCELED,
					}),
					_count: {
						_all: true,
					},
					_sum: {
						amount: true,
					},
				}),
			]);

			return [
				direction,
				{
					total: toInstallmentSummaryBucket(total),
					pending: toInstallmentSummaryBucket(pending),
					paid: toInstallmentSummaryBucket(paid),
					canceled: toInstallmentSummaryBucket(canceled),
				},
			] as const;
		}),
	);

	return Object.fromEntries(summaries) as InstallmentSummaryByDirection;
}

export async function loadOrganizationCommissionInstallments({
	organizationId,
	page,
	pageSize,
	q,
	productId,
	direction,
	status,
	expectedFrom,
	expectedTo,
}: OrganizationCommissionInstallmentsFilters & {
	page: number;
	pageSize: number;
}) {
	const where = buildOrganizationCommissionInstallmentsWhere({
		organizationId,
		q,
		productId,
		status,
		expectedFrom,
		expectedTo,
		direction,
	});
	const skip = (page - 1) * pageSize;

	const [total, installments, summaryByDirection] = await Promise.all([
		prisma.saleCommissionInstallment.count({
			where,
		}),
		prisma.saleCommissionInstallment.findMany({
			where,
			orderBy: [
				{ status: "asc" },
				{ expectedPaymentDate: "asc" },
				{ createdAt: "desc" },
			],
			skip,
			take: pageSize,
			select: {
				id: true,
				saleCommissionId: true,
				installmentNumber: true,
				percentage: true,
				amount: true,
				status: true,
				expectedPaymentDate: true,
				paymentDate: true,
				saleCommission: {
					select: {
						saleId: true,
						recipientType: true,
						sourceType: true,
						direction: true,
						beneficiaryCompanyId: true,
						beneficiaryUnitId: true,
						beneficiarySellerId: true,
						beneficiaryPartnerId: true,
						beneficiarySupervisorId: true,
						beneficiaryLabel: true,
						beneficiaryCompany: {
							select: {
								name: true,
							},
						},
						beneficiaryUnit: {
							select: {
								name: true,
								company: {
									select: {
										name: true,
									},
								},
							},
						},
						beneficiarySeller: {
							select: {
								name: true,
							},
						},
						beneficiaryPartner: {
							select: {
								name: true,
							},
						},
						beneficiarySupervisor: {
							select: {
								user: {
									select: {
										name: true,
										email: true,
									},
								},
							},
						},
						sale: {
							select: {
								id: true,
								status: true,
								saleDate: true,
								customer: {
									select: {
										id: true,
										name: true,
									},
								},
								product: {
									select: {
										id: true,
										name: true,
									},
								},
								company: {
									select: {
										id: true,
										name: true,
									},
								},
								unit: {
									select: {
										id: true,
										name: true,
									},
								},
							},
						},
					},
				},
			},
		}),
		loadOrganizationInstallmentsSummaryByDirection({
			organizationId,
			q,
			productId,
			status,
			expectedFrom,
			expectedTo,
		}),
	]);

	return {
		items: installments.map((installment) => {
			const beneficiaryId = resolveSaleCommissionBeneficiaryId({
				recipientType: installment.saleCommission.recipientType,
				beneficiaryCompanyId: installment.saleCommission.beneficiaryCompanyId,
				beneficiaryUnitId: installment.saleCommission.beneficiaryUnitId,
				beneficiarySellerId: installment.saleCommission.beneficiarySellerId,
				beneficiaryPartnerId: installment.saleCommission.beneficiaryPartnerId,
				beneficiarySupervisorId:
					installment.saleCommission.beneficiarySupervisorId,
			});
			const beneficiaryLabel = resolveSaleCommissionBeneficiaryLabel({
				recipientType: installment.saleCommission.recipientType,
				beneficiaryLabel: installment.saleCommission.beneficiaryLabel,
				beneficiaryCompany: installment.saleCommission.beneficiaryCompany,
				beneficiaryUnit: installment.saleCommission.beneficiaryUnit,
				beneficiarySeller: installment.saleCommission.beneficiarySeller,
				beneficiaryPartner: installment.saleCommission.beneficiaryPartner,
				beneficiarySupervisor: installment.saleCommission.beneficiarySupervisor,
			});

			return {
				id: installment.id,
				saleId: installment.saleCommission.sale.id,
				saleStatus: installment.saleCommission.sale.status,
				saleDate: installment.saleCommission.sale.saleDate,
				customer: installment.saleCommission.sale.customer,
				product: installment.saleCommission.sale.product,
				company: installment.saleCommission.sale.company,
				unit: installment.saleCommission.sale.unit,
				saleCommissionId: installment.saleCommissionId,
				installmentNumber: installment.installmentNumber,
				recipientType: installment.saleCommission.recipientType,
				sourceType: installment.saleCommission.sourceType,
				direction: installment.saleCommission.direction,
				beneficiaryId,
				beneficiaryLabel,
				beneficiaryKey: resolveSaleCommissionBeneficiaryKey({
					saleCommissionId: installment.saleCommissionId,
					recipientType: installment.saleCommission.recipientType,
					beneficiaryId,
					beneficiaryLabel,
				}),
				percentage: fromScaledPercentage(installment.percentage),
				amount: installment.amount,
				status: installment.status,
				expectedPaymentDate: installment.expectedPaymentDate,
				paymentDate: installment.paymentDate,
			};
		}),
		pagination: {
			page,
			pageSize,
			total,
			totalPages: Math.max(1, Math.ceil(total / pageSize)),
		},
		summaryByDirection,
	};
}
