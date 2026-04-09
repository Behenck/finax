import type { Prisma } from "generated/prisma/client";
import { SaleStatus } from "generated/prisma/enums";
import { BadRequestError } from "../_errors/bad-request-error";
import type {
	SaleDelinquencyOccurrence,
	SaleDelinquencySummary,
} from "./sale-schemas";

type SaleDelinquencyDbClient = Pick<
	Prisma.TransactionClient,
	"sale" | "saleDelinquency"
>;

type SaleDelinquencySummaryRow = {
	saleId?: string;
	dueDate: Date;
	resolvedAt: Date | null;
};

function compareByDueDateAsc(
	left: { dueDate: Date },
	right: { dueDate: Date },
) {
	return left.dueDate.getTime() - right.dueDate.getTime();
}

export function createEmptySaleDelinquencySummary(): SaleDelinquencySummary {
	return {
		hasOpen: false,
		openCount: 0,
		oldestDueDate: null,
		latestDueDate: null,
	};
}

export function buildSaleDelinquencySummary(
	rows: SaleDelinquencySummaryRow[],
): SaleDelinquencySummary {
	const openRows = rows
		.filter((row) => row.resolvedAt === null)
		.sort(compareByDueDateAsc);

	if (openRows.length === 0) {
		return createEmptySaleDelinquencySummary();
	}

	return {
		hasOpen: true,
		openCount: openRows.length,
		oldestDueDate: openRows[0]?.dueDate ?? null,
		latestDueDate: openRows.at(-1)?.dueDate ?? null,
	};
}

export async function loadSaleDelinquencySummaryBySaleIds(
	client: Pick<Prisma.TransactionClient, "saleDelinquency">,
	organizationId: string,
	saleIds: string[],
) {
	const uniqueSaleIds = Array.from(new Set(saleIds));
	const summaries = new Map<string, SaleDelinquencySummary>(
		uniqueSaleIds.map((saleId) => [saleId, createEmptySaleDelinquencySummary()]),
	);

	if (uniqueSaleIds.length === 0) {
		return summaries;
	}

	const rows = await client.saleDelinquency.findMany({
		where: {
			organizationId,
			saleId: {
				in: uniqueSaleIds,
			},
		},
		select: {
			saleId: true,
			dueDate: true,
			resolvedAt: true,
		},
	});

	const rowsBySaleId = new Map<string, SaleDelinquencySummaryRow[]>();

	for (const row of rows) {
		const currentRows = rowsBySaleId.get(row.saleId) ?? [];
		currentRows.push(row);
		rowsBySaleId.set(row.saleId, currentRows);
	}

	for (const saleId of uniqueSaleIds) {
		summaries.set(
			saleId,
			buildSaleDelinquencySummary(rowsBySaleId.get(saleId) ?? []),
		);
	}

	return summaries;
}

export async function loadOpenSaleDelinquenciesBySaleIds(
	client: Pick<Prisma.TransactionClient, "saleDelinquency">,
	organizationId: string,
	saleIds: string[],
) {
	const uniqueSaleIds = Array.from(new Set(saleIds));
	const occurrencesBySaleId = new Map<string, SaleDelinquencyOccurrence[]>(
		uniqueSaleIds.map((saleId) => [saleId, []]),
	);

	if (uniqueSaleIds.length === 0) {
		return occurrencesBySaleId;
	}

	const rows = await client.saleDelinquency.findMany({
		where: {
			organizationId,
			saleId: {
				in: uniqueSaleIds,
			},
			resolvedAt: null,
		},
		orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
		select: {
			id: true,
			saleId: true,
			dueDate: true,
			resolvedAt: true,
			createdAt: true,
			updatedAt: true,
			createdBy: {
				select: {
					id: true,
					name: true,
					avatarUrl: true,
				},
			},
			resolvedBy: {
				select: {
					id: true,
					name: true,
					avatarUrl: true,
				},
			},
		},
	});

	for (const row of rows) {
		const currentRows = occurrencesBySaleId.get(row.saleId) ?? [];
		currentRows.push({
			id: row.id,
			dueDate: row.dueDate,
			resolvedAt: row.resolvedAt,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			createdBy: row.createdBy,
			resolvedBy: row.resolvedBy,
		});
		occurrencesBySaleId.set(row.saleId, currentRows);
	}

	return occurrencesBySaleId;
}

export async function loadSaleDelinquencies(
	client: Pick<Prisma.TransactionClient, "saleDelinquency">,
	organizationId: string,
	saleId: string,
) {
	const rows = await client.saleDelinquency.findMany({
		where: {
			organizationId,
			saleId,
		},
		orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
		select: {
			id: true,
			dueDate: true,
			resolvedAt: true,
			createdAt: true,
			updatedAt: true,
			createdBy: {
				select: {
					id: true,
					name: true,
					avatarUrl: true,
				},
			},
			resolvedBy: {
				select: {
					id: true,
					name: true,
					avatarUrl: true,
				},
			},
		},
	});

	const mappedRows: SaleDelinquencyOccurrence[] = rows.map((row) => ({
		id: row.id,
		dueDate: row.dueDate,
		resolvedAt: row.resolvedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		createdBy: row.createdBy,
		resolvedBy: row.resolvedBy,
	}));

	const openDelinquencies = mappedRows
		.filter((row) => row.resolvedAt === null)
		.sort(compareByDueDateAsc);
	const delinquencyHistory = mappedRows
		.filter((row) => row.resolvedAt !== null)
		.sort((left, right) => {
			const rightResolvedAt = right.resolvedAt?.getTime() ?? 0;
			const leftResolvedAt = left.resolvedAt?.getTime() ?? 0;
			return rightResolvedAt - leftResolvedAt;
		});

	return {
		delinquencySummary: buildSaleDelinquencySummary(rows),
		openDelinquencies,
		delinquencyHistory,
	};
}

export async function assertSaleCanCreateDelinquency(
	client: SaleDelinquencyDbClient,
	params: {
		organizationId: string;
		saleId: string;
		dueDate: Date;
	},
) {
	const sale = await client.sale.findFirst({
		where: {
			id: params.saleId,
			organizationId: params.organizationId,
		},
		select: {
			id: true,
			status: true,
		},
	});

	if (!sale) {
		throw new BadRequestError("Sale not found");
	}

	if (sale.status !== SaleStatus.COMPLETED) {
		throw new BadRequestError(
			"Delinquency can only be created for completed sales",
		);
	}

	const duplicatedOpenDelinquency = await client.saleDelinquency.findFirst({
		where: {
			saleId: params.saleId,
			organizationId: params.organizationId,
			dueDate: params.dueDate,
			resolvedAt: null,
		},
		select: {
			id: true,
		},
	});

	if (duplicatedOpenDelinquency) {
		throw new BadRequestError(
			"An open delinquency already exists for this due date",
		);
	}
}
