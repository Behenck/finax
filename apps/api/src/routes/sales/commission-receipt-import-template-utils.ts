import type { Prisma } from "generated/prisma/client";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	type CommissionReceiptImportTemplateMapping,
	CommissionReceiptImportTemplateMappingSchema,
} from "./commission-receipt-import-schemas";

export const COMMISSION_RECEIPT_TEMPLATE_NAME_PREFIX =
	"__commission_receipt__::";

export function toCommissionReceiptStoredTemplateName(name: string) {
	return `${COMMISSION_RECEIPT_TEMPLATE_NAME_PREFIX}${name.trim()}`;
}

export function fromCommissionReceiptStoredTemplateName(storedName: string) {
	if (!storedName.startsWith(COMMISSION_RECEIPT_TEMPLATE_NAME_PREFIX)) {
		return null;
	}

	return storedName.slice(COMMISSION_RECEIPT_TEMPLATE_NAME_PREFIX.length);
}

export function isCommissionReceiptTemplateStoredName(storedName: string) {
	return storedName.startsWith(COMMISSION_RECEIPT_TEMPLATE_NAME_PREFIX);
}

export function parseCommissionReceiptTemplateMappingJson(
	value: Prisma.JsonValue,
): CommissionReceiptImportTemplateMapping {
	const parsed = CommissionReceiptImportTemplateMappingSchema.safeParse(value);
	if (!parsed.success) {
		throw new BadRequestError(
			"Stored commission receipt import template mapping is invalid",
		);
	}

	return parsed.data;
}
