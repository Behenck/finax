import type { PrismaClient, Prisma } from "generated/prisma/client";
import { TransactionType } from "generated/prisma/enums";
import { BadRequestError } from "../_errors/bad-request-error";

type ProductSalesTransactionConfigInput = {
	salesTransactionCategoryId?: string | null;
	salesTransactionCostCenterId?: string | null;
};

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

export async function assertProductSalesTransactionConfig(
	prismaClient: PrismaClientLike,
	organizationId: string,
	input: ProductSalesTransactionConfigInput,
) {
	if (input.salesTransactionCategoryId) {
		const category = await prismaClient.category.findFirst({
			where: {
				id: input.salesTransactionCategoryId,
				type: TransactionType.INCOME,
				organizationId,
			},
			select: {
				id: true,
			},
		});

		if (!category) {
			throw new BadRequestError(
				"Sales transaction category must be an INCOME category from this organization",
			);
		}
	}

	if (input.salesTransactionCostCenterId) {
		const costCenter = await prismaClient.costCenter.findFirst({
			where: {
				id: input.salesTransactionCostCenterId,
				organizationId,
			},
			select: {
				id: true,
			},
		});

		if (!costCenter) {
			throw new BadRequestError(
				"Sales transaction cost center must belong to this organization",
			);
		}
	}
}
