import { prisma } from "@/lib/prisma";
import type { Prisma } from "generated/prisma/client";
import {
	CustomerResponsibleType,
	MemberDataScope,
	SaleResponsibleType,
} from "generated/prisma/enums";

type MemberCompanyAccess = {
	companyId: string;
	unitId: string | null;
};

export type MemberDataVisibilityContext = {
	memberId: string;
	userId: string;
	customersScope: MemberDataScope;
	salesScope: MemberDataScope;
	commissionsScope: MemberDataScope;
	partnersScope: MemberDataScope;
	memberCompanyAccesses: MemberCompanyAccess[];
	linkedSellerIds: string[];
	linkedPartnerIds: string[];
};

export async function loadMemberDataVisibilityContext(params: {
	organizationId: string;
	memberId: string;
	userId: string;
	customersScope: MemberDataScope;
	salesScope: MemberDataScope;
	commissionsScope: MemberDataScope;
	partnersScope?: MemberDataScope;
}) {
	const [memberCompanyAccesses, linkedSellers, linkedPartners] = await Promise.all(
		[
			prisma.memberCompanyAccess.findMany({
				where: {
					memberId: params.memberId,
					organizationId: params.organizationId,
				},
				select: {
					companyId: true,
					unitId: true,
				},
			}),
			prisma.seller.findMany({
				where: {
					organizationId: params.organizationId,
					userId: params.userId,
				},
				select: {
					id: true,
				},
			}),
			prisma.partner.findMany({
				where: {
					organizationId: params.organizationId,
					userId: params.userId,
				},
				select: {
					id: true,
				},
			}),
		],
	);

	return {
		memberId: params.memberId,
		userId: params.userId,
		customersScope: params.customersScope,
		salesScope: params.salesScope,
		commissionsScope: params.commissionsScope,
		partnersScope: params.partnersScope ?? MemberDataScope.ORGANIZATION_ALL,
		memberCompanyAccesses,
		linkedSellerIds: linkedSellers.map((seller) => seller.id),
		linkedPartnerIds: linkedPartners.map((partner) => partner.id),
	} satisfies MemberDataVisibilityContext;
}

function getNormalizedMemberAccesses(accesses: MemberCompanyAccess[]) {
	return Array.from(
		new Map(
			accesses.map((access) => [
				`${access.companyId}:${access.unitId ?? "ALL"}`,
				{
					companyId: access.companyId,
					unitId: access.unitId,
				},
			]),
		).values(),
	);
}

function buildSaleCompanyAccessWhere(
	accesses: MemberCompanyAccess[],
): Prisma.SaleWhereInput | null {
	if (accesses.length === 0) {
		return null;
	}

	const normalizedAccesses = getNormalizedMemberAccesses(accesses);
	const companyWideAccesses = new Set(
		normalizedAccesses
			.filter((access) => access.unitId === null)
			.map((access) => access.companyId),
	);
	const unitAccessesByCompany = new Map<string, Set<string>>();

	for (const access of normalizedAccesses) {
		if (access.unitId === null || companyWideAccesses.has(access.companyId)) {
			continue;
		}

		const currentSet = unitAccessesByCompany.get(access.companyId) ?? new Set();
		currentSet.add(access.unitId);
		unitAccessesByCompany.set(access.companyId, currentSet);
	}

	const orConditions: Prisma.SaleWhereInput[] = [];

	for (const companyId of companyWideAccesses) {
		orConditions.push({
			companyId,
		});
	}

	for (const [companyId, unitIds] of unitAccessesByCompany.entries()) {
		orConditions.push({
			companyId,
			unitId: {
				in: Array.from(unitIds),
			},
		});
	}

	if (orConditions.length === 0) {
		return {
			id: {
				in: [] as string[],
			},
		};
	}

	if (orConditions.length === 1) {
		return orConditions[0];
	}

	return {
		OR: orConditions,
	};
}

function buildLinkedSaleResponsibleConditions(
	context: Pick<MemberDataVisibilityContext, "linkedSellerIds" | "linkedPartnerIds">,
) {
	const conditions: Prisma.SaleWhereInput[] = [];

	if (context.linkedSellerIds.length > 0) {
		conditions.push({
			responsibleType: SaleResponsibleType.SELLER,
			responsibleId: {
				in: context.linkedSellerIds,
			},
		});
	}

	if (context.linkedPartnerIds.length > 0) {
		conditions.push({
			responsibleType: SaleResponsibleType.PARTNER,
			responsibleId: {
				in: context.linkedPartnerIds,
			},
		});
	}

	return conditions;
}

function buildCommissionBeneficiaryMatchConditions(
	context: Pick<
		MemberDataVisibilityContext,
		"memberId" | "linkedSellerIds" | "linkedPartnerIds"
	>,
) {
	const conditions: Prisma.SaleCommissionWhereInput[] = [
		{
			beneficiarySupervisorId: context.memberId,
		},
	];

	if (context.linkedSellerIds.length > 0) {
		conditions.push({
			beneficiarySellerId: {
				in: context.linkedSellerIds,
			},
		});
	}

	if (context.linkedPartnerIds.length > 0) {
		conditions.push({
			beneficiaryPartnerId: {
				in: context.linkedPartnerIds,
			},
		});
	}

	return conditions;
}

function toOrSaleWhere(
	conditions: Prisma.SaleWhereInput[],
): Prisma.SaleWhereInput | null {
	if (conditions.length === 0) {
		return null;
	}

	if (conditions.length === 1) {
		return conditions[0];
	}

	return {
		OR: conditions,
	};
}

function toOrCustomerWhere(
	conditions: Prisma.CustomerWhereInput[],
): Prisma.CustomerWhereInput | null {
	if (conditions.length === 0) {
		return null;
	}

	if (conditions.length === 1) {
		return conditions[0];
	}

	return {
		OR: conditions,
	};
}

function toOrSaleCommissionWhere(
	conditions: Prisma.SaleCommissionWhereInput[],
): Prisma.SaleCommissionWhereInput | null {
	if (conditions.length === 0) {
		return null;
	}

	if (conditions.length === 1) {
		return conditions[0];
	}

	return {
		OR: conditions,
	};
}

function toOrInstallmentsWhere(
	conditions: Prisma.SaleCommissionInstallmentWhereInput[],
): Prisma.SaleCommissionInstallmentWhereInput | null {
	if (conditions.length === 0) {
		return null;
	}

	if (conditions.length === 1) {
		return conditions[0];
	}

	return {
		OR: conditions,
	};
}

export function buildCustomersVisibilityWhere(params: {
	organizationId: string;
	context: MemberDataVisibilityContext;
}): Prisma.CustomerWhereInput | undefined {
	const { organizationId, context } = params;

	if (context.customersScope === MemberDataScope.ORGANIZATION_ALL) {
		return undefined;
	}

	if (context.customersScope === MemberDataScope.COMPANY_ONLY) {
		const companyAccessWhere = buildSaleCompanyAccessWhere(
			context.memberCompanyAccesses,
		);

		if (!companyAccessWhere) {
			return undefined;
		}

		return {
			sales: {
				some: {
					organizationId,
					...companyAccessWhere,
				},
			},
		};
	}

	const customerLinkConditions: Prisma.CustomerWhereInput[] = [];
	const linkedSaleResponsibleConditions =
		buildLinkedSaleResponsibleConditions(context);
	const linkedSalesFilter = toOrSaleWhere(linkedSaleResponsibleConditions);

	if (context.linkedSellerIds.length > 0) {
		customerLinkConditions.push({
			responsibleType: CustomerResponsibleType.SELLER,
			responsibleId: {
				in: context.linkedSellerIds,
			},
		});
	}

	if (context.linkedPartnerIds.length > 0) {
		customerLinkConditions.push({
			responsibleType: CustomerResponsibleType.PARTNER,
			responsibleId: {
				in: context.linkedPartnerIds,
			},
		});
	}

	if (linkedSalesFilter) {
		customerLinkConditions.push({
			sales: {
				some: {
					organizationId,
					...linkedSalesFilter,
				},
			},
		});
	}

	const linkedFilter = toOrCustomerWhere(customerLinkConditions);
	if (!linkedFilter) {
		return {
			id: {
				in: [] as string[],
			},
		};
	}

	return linkedFilter;
}

export function buildSalesVisibilityWhere(
	context: MemberDataVisibilityContext,
): Prisma.SaleWhereInput | undefined {
	if (context.salesScope === MemberDataScope.ORGANIZATION_ALL) {
		return undefined;
	}

	if (context.salesScope === MemberDataScope.COMPANY_ONLY) {
		return (
			buildSaleCompanyAccessWhere(context.memberCompanyAccesses) ?? undefined
		);
	}

	const linkedConditions = buildLinkedSaleResponsibleConditions(context);
	const commissionBeneficiaryFilter = toOrSaleCommissionWhere(
		buildCommissionBeneficiaryMatchConditions(context),
	);

	if (commissionBeneficiaryFilter) {
		linkedConditions.push({
			commissions: {
				some: commissionBeneficiaryFilter,
			},
		});
	}

	const linkedFilter = toOrSaleWhere(linkedConditions);
	if (!linkedFilter) {
		return {
			id: {
				in: [] as string[],
			},
		};
	}

	return linkedFilter;
}

export function buildSaleCommissionsBeneficiaryVisibilityWhere(
	context: Pick<
		MemberDataVisibilityContext,
		"memberId" | "linkedSellerIds" | "linkedPartnerIds"
	>,
): Prisma.SaleCommissionWhereInput {
	return (
		toOrSaleCommissionWhere(buildCommissionBeneficiaryMatchConditions(context)) ?? {
			id: {
				in: [] as string[],
			},
		}
	);
}

export function buildCommissionInstallmentsVisibilityWhere(
	context: MemberDataVisibilityContext,
): Prisma.SaleCommissionInstallmentWhereInput | undefined {
	if (context.commissionsScope === MemberDataScope.ORGANIZATION_ALL) {
		return undefined;
	}

	if (context.commissionsScope === MemberDataScope.COMPANY_ONLY) {
		const companyAccessWhere = buildSaleCompanyAccessWhere(
			context.memberCompanyAccesses,
		);

		if (!companyAccessWhere) {
			return undefined;
		}

		return {
			saleCommission: {
				sale: companyAccessWhere,
			},
		};
	}

	const linkedSaleResponsibleConditions =
		buildLinkedSaleResponsibleConditions(context);
	const installmentLinkedConditions: Prisma.SaleCommissionInstallmentWhereInput[] = [];

	const beneficiaryFilter = toOrSaleCommissionWhere(
		buildCommissionBeneficiaryMatchConditions(context),
	);
	if (beneficiaryFilter) {
		installmentLinkedConditions.push({
			saleCommission: beneficiaryFilter,
		});
	}

	const linkedSalesFilter = toOrSaleWhere(linkedSaleResponsibleConditions);
	if (linkedSalesFilter) {
		installmentLinkedConditions.push({
			saleCommission: {
				sale: linkedSalesFilter,
			},
		});
	}

	const linkedInstallmentsFilter = toOrInstallmentsWhere(
		installmentLinkedConditions,
	);
	if (!linkedInstallmentsFilter) {
		return {
			id: {
				in: [] as string[],
			},
		};
	}

	return linkedInstallmentsFilter;
}

export function buildPartnersVisibilityWhere(
	context: Pick<MemberDataVisibilityContext, "partnersScope" | "userId">,
): Prisma.PartnerWhereInput | undefined {
	if (context.partnersScope === MemberDataScope.ORGANIZATION_ALL) {
		return undefined;
	}

	return {
		supervisorId: context.userId,
	};
}
