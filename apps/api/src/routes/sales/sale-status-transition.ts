import { SaleStatus } from "generated/prisma/enums";

interface SaleStatusTransitionOptions {
	allowCompletedCancellation?: boolean;
}

export function isValidSaleStatusTransition(
	from: SaleStatus,
	to: SaleStatus,
	options: SaleStatusTransitionOptions = {},
) {
	const { allowCompletedCancellation = false } = options;

	if (from === SaleStatus.PENDING) {
		return to === SaleStatus.COMPLETED || to === SaleStatus.CANCELED;
	}

	if (from === SaleStatus.COMPLETED) {
		return allowCompletedCancellation && to === SaleStatus.CANCELED;
	}

	return false;
}
