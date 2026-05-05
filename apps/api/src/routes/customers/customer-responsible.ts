import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import { getPartnerDisplayName } from "@/utils/partner-display";

export const customerResponsibleTypeValues = ["SELLER", "PARTNER"] as const;
export type CustomerResponsibleTypeValue =
	(typeof customerResponsibleTypeValues)[number];

export type CustomerResponsibleInput =
	| { type: "SELLER"; id: string }
	| { type: "PARTNER"; id: string }
	| null
	| undefined;

type CustomerResponsiblePayload =
	| { type: "SELLER"; id: string; name: string }
	| { type: "PARTNER"; id: string; name: string };

export async function resolveCustomerResponsibleData(
	organizationId: string,
	responsible: CustomerResponsibleInput,
) {
	if (responsible === undefined) {
		return undefined;
	}

	if (responsible === null) {
		return {
			responsibleType: null,
			responsibleId: null,
		};
	}

	if (responsible.type === "SELLER") {
		const seller = await prisma.seller.findFirst({
			where: {
				id: responsible.id,
				organizationId,
			},
			select: { id: true },
		});

		if (!seller) {
			throw new BadRequestError("Seller not found");
		}

		return {
			responsibleType: "SELLER",
			responsibleId: seller.id,
		} as const;
	}

	const partner = await prisma.partner.findFirst({
		where: {
			id: responsible.id,
			organizationId,
		},
		select: { id: true },
	});

	if (!partner) {
		throw new BadRequestError("Partner not found");
	}

	return {
		responsibleType: "PARTNER",
		responsibleId: partner.id,
	} as const;
}

type CustomerResponsibleLookupInput = {
	responsibleType?: string | null;
	responsibleId?: string | null;
};

export async function loadCustomerResponsible(
	organizationId: string,
	customer: CustomerResponsibleLookupInput,
) {
	if (customer.responsibleType === "SELLER" && customer.responsibleId) {
		const seller = await prisma.seller.findFirst({
			where: {
				id: customer.responsibleId,
				organizationId,
			},
			select: {
				id: true,
				name: true,
			},
		});

		if (!seller) {
			return null;
		}

		return {
			type: "SELLER" as const,
			id: seller.id,
			name: seller.name,
		};
	}

	if (customer.responsibleType === "PARTNER" && customer.responsibleId) {
		const partner = await prisma.partner.findFirst({
			where: {
				id: customer.responsibleId,
				organizationId,
			},
			select: {
				id: true,
				name: true,
				companyName: true,
			},
		});

		if (!partner) {
			return null;
		}

		return {
			type: "PARTNER" as const,
			id: partner.id,
			name: getPartnerDisplayName(partner),
		};
	}

	return null;
}

export async function loadCustomersResponsible(
	organizationId: string,
	customers: Array<{
		id: string;
		responsibleType?: string | null;
		responsibleId?: string | null;
	}>,
) {
	const sellerIds = Array.from(
		new Set(
			customers
				.filter(
					(customer) =>
						customer.responsibleType === "SELLER" && !!customer.responsibleId,
				)
				.map((customer) => customer.responsibleId as string),
		),
	);

	const partnerIds = Array.from(
		new Set(
			customers
				.filter(
					(customer) =>
						customer.responsibleType === "PARTNER" && !!customer.responsibleId,
				)
				.map((customer) => customer.responsibleId as string),
		),
	);

	const [sellers, partners] = await Promise.all([
		sellerIds.length
			? prisma.seller.findMany({
					where: {
						organizationId,
						id: { in: sellerIds },
					},
					select: {
						id: true,
						name: true,
					},
				})
			: Promise.resolve([]),
		partnerIds.length
			? prisma.partner.findMany({
					where: {
						organizationId,
						id: { in: partnerIds },
					},
					select: {
						id: true,
						name: true,
						companyName: true,
					},
				})
			: Promise.resolve([]),
	]);

	const sellersById = new Map(sellers.map((seller) => [seller.id, seller]));
	const partnersById = new Map(
		partners.map((partner) => [partner.id, partner]),
	);

	const entries: Array<[string, CustomerResponsiblePayload | null]> =
		customers.map((customer) => {
			if (customer.responsibleType === "SELLER" && customer.responsibleId) {
				const seller = sellersById.get(customer.responsibleId);
				return [
					customer.id,
					seller
						? ({ type: "SELLER", id: seller.id, name: seller.name } as const)
						: null,
				];
			}

			if (customer.responsibleType === "PARTNER" && customer.responsibleId) {
				const partner = partnersById.get(customer.responsibleId);
				return [
					customer.id,
					partner
						? ({
								type: "PARTNER",
								id: partner.id,
								name: getPartnerDisplayName(partner),
							} as const)
						: null,
				];
			}

			return [customer.id, null];
		});

	return new Map<string, CustomerResponsiblePayload | null>(entries);
}
