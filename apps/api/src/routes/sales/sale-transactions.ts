import type { Prisma } from "generated/prisma/client";
import {
	TransactionNature,
	TransactionStatus,
	TransactionType,
} from "generated/prisma/enums";
import { generateHexCode } from "@/utils/generate-hex-code";
import { BadRequestError } from "../_errors/bad-request-error";

type SaleTransactionSyncPayload = {
	id: string;
	totalAmount: number;
	companyId: string;
	unitId: string | null;
	product: {
		name: string;
		salesTransactionCategoryId: string | null;
		salesTransactionCostCenterId: string | null;
	};
	customer: {
		name: string;
	};
};

async function loadSaleTransactionSyncPayload(
	tx: Prisma.TransactionClient,
	saleId: string,
	organizationId: string,
): Promise<SaleTransactionSyncPayload | null> {
	return tx.sale.findFirst({
		where: {
			id: saleId,
			organizationId,
		},
		select: {
			id: true,
			totalAmount: true,
			companyId: true,
			unitId: true,
			product: {
				select: {
					name: true,
					salesTransactionCategoryId: true,
					salesTransactionCostCenterId: true,
				},
			},
			customer: {
				select: {
					name: true,
				},
			},
		},
	});
}

function buildSaleTransactionDescription(sale: SaleTransactionSyncPayload) {
	return `Receita de venda: ${sale.product.name} - ${sale.customer.name} (${sale.id})`;
}

function buildPendingSaleTransactionUpdateData(
	sale: SaleTransactionSyncPayload,
): Prisma.TransactionUncheckedUpdateInput {
	const data: Prisma.TransactionUncheckedUpdateInput = {
		description: buildSaleTransactionDescription(sale),
		totalAmount: sale.totalAmount,
		type: TransactionType.INCOME,
		nature: TransactionNature.VARIABLE,
		companyId: sale.companyId,
		unitId: sale.unitId,
	};

	if (sale.product.salesTransactionCategoryId) {
		data.categoryId = sale.product.salesTransactionCategoryId;
	}

	if (sale.product.salesTransactionCostCenterId) {
		data.costCenterId = sale.product.salesTransactionCostCenterId;
	}

	return data;
}

export async function createOrSyncSaleTransactionOnSaleCompleted(
	tx: Prisma.TransactionClient,
	params: {
		saleId: string;
		organizationId: string;
		actorId: string;
		completedAt: Date;
	},
) {
	const sale = await loadSaleTransactionSyncPayload(
		tx,
		params.saleId,
		params.organizationId,
	);

	if (!sale) {
		throw new BadRequestError("Sale not found");
	}

	const linkedTransaction = await tx.transaction.findFirst({
		where: {
			organizationId: params.organizationId,
			saleId: sale.id,
		},
		select: {
			id: true,
			status: true,
		},
	});

	if (!linkedTransaction) {
		if (
			!sale.product.salesTransactionCategoryId ||
			!sale.product.salesTransactionCostCenterId
		) {
			return;
		}

		await tx.transaction.create({
			data: {
				code: generateHexCode(),
				description: buildSaleTransactionDescription(sale),
				totalAmount: sale.totalAmount,
				type: TransactionType.INCOME,
				status: TransactionStatus.PENDING,
				nature: TransactionNature.VARIABLE,
				dueDate: params.completedAt,
				expectedPaymentDate: params.completedAt,
				paymentDate: null,
				costCenterId: sale.product.salesTransactionCostCenterId,
				organizationId: params.organizationId,
				companyId: sale.companyId,
				unitId: sale.unitId,
				createdById: params.actorId,
				categoryId: sale.product.salesTransactionCategoryId,
				saleId: sale.id,
			},
		});

		return;
	}

	if (linkedTransaction.status !== TransactionStatus.PENDING) {
		return;
	}

	await tx.transaction.update({
		where: {
			id: linkedTransaction.id,
		},
		data: buildPendingSaleTransactionUpdateData(sale),
	});
}

export async function syncPendingSaleTransactionFromSale(
	tx: Prisma.TransactionClient,
	params: {
		saleId: string;
		organizationId: string;
	},
) {
	const linkedTransaction = await tx.transaction.findFirst({
		where: {
			organizationId: params.organizationId,
			saleId: params.saleId,
			status: TransactionStatus.PENDING,
		},
		select: {
			id: true,
		},
	});

	if (!linkedTransaction) {
		return;
	}

	const sale = await loadSaleTransactionSyncPayload(
		tx,
		params.saleId,
		params.organizationId,
	);

	if (!sale) {
		return;
	}

	await tx.transaction.update({
		where: {
			id: linkedTransaction.id,
		},
		data: buildPendingSaleTransactionUpdateData(sale),
	});
}

export async function cancelPendingSaleTransactionForSale(
	tx: Prisma.TransactionClient,
	params: {
		saleId: string;
		organizationId: string;
	},
) {
	await tx.transaction.updateMany({
		where: {
			organizationId: params.organizationId,
			saleId: params.saleId,
			status: TransactionStatus.PENDING,
		},
		data: {
			status: TransactionStatus.CANCELED,
			paymentDate: null,
		},
	});
}
