import { prisma } from "@/lib/prisma";
import { PartnerStatus, SellerStatus } from "generated/prisma/enums";
import { BadRequestError } from "../_errors/bad-request-error";
import type { SaleResponsibleInput } from "./sale-schemas";

type SaleResponsiblePayload =
	| { type: "SELLER"; id: string; name: string }
	| { type: "PARTNER"; id: string; name: string };

type SaleResponsibleLookupInput = {
	id: string;
	responsibleType?: string | null;
	responsibleId?: string | null;
};

export async function resolveSaleResponsibleData(
	organizationId: string,
	responsible: SaleResponsibleInput,
) {
	if (responsible.type === "SELLER") {
		const seller = await prisma.seller.findFirst({
			where: {
				id: responsible.id,
				organizationId,
				status: SellerStatus.ACTIVE,
			},
			select: {
				id: true,
			},
		});

		if (!seller) {
			throw new BadRequestError("Seller not found or inactive");
		}

		return {
			responsibleType: "SELLER" as const,
			responsibleId: seller.id,
		};
	}

	const partner = await prisma.partner.findFirst({
		where: {
			id: responsible.id,
			organizationId,
			status: PartnerStatus.ACTIVE,
		},
		select: {
			id: true,
		},
	});

	if (!partner) {
		throw new BadRequestError("Partner not found or inactive");
	}

	return {
		responsibleType: "PARTNER" as const,
		responsibleId: partner.id,
	};
}

export async function loadSaleResponsible(
	organizationId: string,
	sale: Omit<SaleResponsibleLookupInput, "id">,
) {
	if (sale.responsibleType === "SELLER" && sale.responsibleId) {
		const seller = await prisma.seller.findFirst({
			where: {
				id: sale.responsibleId,
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

	if (sale.responsibleType === "PARTNER" && sale.responsibleId) {
		const partner = await prisma.partner.findFirst({
			where: {
				id: sale.responsibleId,
				organizationId,
			},
			select: {
				id: true,
				name: true,
			},
		});

		if (!partner) {
			return null;
		}

		return {
			type: "PARTNER" as const,
			id: partner.id,
			name: partner.name,
		};
	}

	return null;
}

export async function loadSalesResponsible(
	organizationId: string,
	sales: SaleResponsibleLookupInput[],
) {
	const sellerIds = Array.from(
		new Set(
			sales
				.filter(
					(sale) =>
						sale.responsibleType === "SELLER" && !!sale.responsibleId,
				)
				.map((sale) => sale.responsibleId as string),
		),
	);

	const partnerIds = Array.from(
		new Set(
			sales
				.filter(
					(sale) =>
						sale.responsibleType === "PARTNER" && !!sale.responsibleId,
				)
				.map((sale) => sale.responsibleId as string),
		),
	);

	const [sellers, partners] = await Promise.all([
		sellerIds.length
			? prisma.seller.findMany({
					where: {
						organizationId,
						id: {
							in: sellerIds,
						},
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
						id: {
							in: partnerIds,
						},
					},
					select: {
						id: true,
						name: true,
					},
			  })
			: Promise.resolve([]),
	]);

	const sellersById = new Map(sellers.map((seller) => [seller.id, seller]));
	const partnersById = new Map(partners.map((partner) => [partner.id, partner]));

	const entries: Array<[string, SaleResponsiblePayload | null]> = sales.map(
		(sale) => {
			if (sale.responsibleType === "SELLER" && sale.responsibleId) {
				const seller = sellersById.get(sale.responsibleId);
				return [
					sale.id,
					seller
						? ({ type: "SELLER", id: seller.id, name: seller.name } as const)
						: null,
				];
			}

			if (sale.responsibleType === "PARTNER" && sale.responsibleId) {
				const partner = partnersById.get(sale.responsibleId);
				return [
					sale.id,
					partner
						? ({ type: "PARTNER", id: partner.id, name: partner.name } as const)
						: null,
				];
			}

			return [sale.id, null];
		},
	);

	return new Map<string, SaleResponsiblePayload | null>(entries);
}
