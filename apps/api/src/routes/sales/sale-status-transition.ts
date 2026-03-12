import { SaleStatus } from "generated/prisma/enums";

export function isValidSaleStatusTransition(from: SaleStatus, to: SaleStatus) {
	if (from === SaleStatus.PENDING) {
		return to === SaleStatus.APPROVED || to === SaleStatus.CANCELED;
	}

	if (from === SaleStatus.APPROVED) {
		return to === SaleStatus.COMPLETED || to === SaleStatus.CANCELED;
	}

	return false;
}
