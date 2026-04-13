import type { Prisma } from "generated/prisma/client";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	type SaleDelinquencyImportTemplateMapping,
	SaleDelinquencyImportTemplateMappingSchema,
} from "./sale-delinquency-import-schemas";

export const SALE_DELINQUENCY_TEMPLATE_NAME_PREFIX =
	"__sale_delinquency__::";

export function toSaleDelinquencyStoredTemplateName(name: string) {
	return `${SALE_DELINQUENCY_TEMPLATE_NAME_PREFIX}${name.trim()}`;
}

export function fromSaleDelinquencyStoredTemplateName(storedName: string) {
	if (!storedName.startsWith(SALE_DELINQUENCY_TEMPLATE_NAME_PREFIX)) {
		return null;
	}

	return storedName.slice(SALE_DELINQUENCY_TEMPLATE_NAME_PREFIX.length);
}

export function isSaleDelinquencyTemplateStoredName(storedName: string) {
	return storedName.startsWith(SALE_DELINQUENCY_TEMPLATE_NAME_PREFIX);
}

export function parseSaleDelinquencyTemplateMappingJson(
	value: Prisma.JsonValue,
): SaleDelinquencyImportTemplateMapping {
	const parsed = SaleDelinquencyImportTemplateMappingSchema.safeParse(value);
	if (!parsed.success) {
		throw new BadRequestError(
			"Stored sale delinquency import template mapping is invalid",
		);
	}

	return parsed.data;
}
