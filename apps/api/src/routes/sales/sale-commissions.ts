import type { Prisma } from "generated/prisma/client";
import {
	PartnerStatus,
	Role,
	type SaleCommissionRecipientType,
	type SaleCommissionSourceType,
	SellerStatus,
} from "generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	fromScaledPercentage,
	type SaleCommissionInput,
	toScaledPercentage,
} from "./sale-schemas";

type ResolvedSaleCommission = {
	sourceType: SaleCommissionSourceType;
	recipientType: SaleCommissionRecipientType;
	beneficiaryCompanyId: string | null;
	beneficiaryUnitId: string | null;
	beneficiarySellerId: string | null;
	beneficiaryPartnerId: string | null;
	beneficiarySupervisorId: string | null;
	beneficiaryLabel: string | null;
	totalPercentage: number;
	sortOrder: number;
	installments: Array<{
		installmentNumber: number;
		percentage: number;
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

export async function resolveSaleCommissionsData(
	organizationId: string,
	commissions: SaleCommissionInput[],
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
			beneficiaryCompanyId,
			beneficiaryUnitId,
			beneficiarySellerId,
			beneficiaryPartnerId,
			beneficiarySupervisorId,
			beneficiaryLabel,
			totalPercentage: toScaledPercentage(commission.totalPercentage),
			sortOrder: index,
			installments: commission.installments.map((installment) => ({
				installmentNumber: installment.installmentNumber,
				percentage: toScaledPercentage(installment.percentage),
			})),
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
				beneficiaryCompanyId: commission.beneficiaryCompanyId,
				beneficiaryUnitId: commission.beneficiaryUnitId,
				beneficiarySellerId: commission.beneficiarySellerId,
				beneficiaryPartnerId: commission.beneficiaryPartnerId,
				beneficiarySupervisorId: commission.beneficiarySupervisorId,
				beneficiaryLabel: commission.beneficiaryLabel,
				totalPercentage: commission.totalPercentage,
				sortOrder: commission.sortOrder,
				installments: {
					create: commission.installments.map((installment) => ({
						installmentNumber: installment.installmentNumber,
						percentage: installment.percentage,
					})),
				},
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
			beneficiaryCompanyId: true,
			beneficiaryUnitId: true,
			beneficiarySellerId: true,
			beneficiaryPartnerId: true,
			beneficiarySupervisorId: true,
			beneficiaryLabel: true,
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
				},
				orderBy: {
					installmentNumber: "asc",
				},
			},
		},
	});

	return commissions.map((commission) => ({
		id: commission.id,
		sourceType: commission.sourceType,
		recipientType: commission.recipientType,
		beneficiaryId: resolveSaleCommissionBeneficiaryId(commission),
		beneficiaryLabel: resolveSaleCommissionBeneficiaryLabel(commission),
		totalPercentage: fromScaledPercentage(commission.totalPercentage),
		sortOrder: commission.sortOrder,
		installments: commission.installments.map((installment) => ({
			installmentNumber: installment.installmentNumber,
			percentage: fromScaledPercentage(installment.percentage),
		})),
	}));
}
