import type { Prisma } from "generated/prisma/client";
import {
	parseSaleDynamicFieldSchemaJson,
	parseSaleDynamicFieldValuesJson,
} from "./sale-dynamic-fields";
import { sanitizeTextValue } from "./sale-import-utils";

function stripLeadingZerosFromDigits(value: string) {
	const normalized = value.replace(/^0+/, "");
	return normalized.length > 0 ? normalized : "0";
}

export function normalizeMatchValue(value: string) {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.normalize("NFKC")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}

export function normalizeComparableMatchValue(
	value: string,
	options?: {
		ignoreLeadingZerosForNumeric?: boolean;
	},
) {
	const normalized = normalizeMatchValue(value);

	if (
		options?.ignoreLeadingZerosForNumeric &&
		normalized.length > 0 &&
		/^\d+$/.test(normalized)
	) {
		return stripLeadingZerosFromDigits(normalized);
	}

	return normalized;
}

export function coerceDynamicValueToComparableText(
	rawValue: unknown,
	options?: {
		ignoreLeadingZerosForNumeric?: boolean;
	},
) {
	if (rawValue === null || rawValue === undefined) {
		return null;
	}

	if (typeof rawValue === "string") {
		const sanitized = sanitizeTextValue(rawValue, { maxLength: 320 });
		return sanitized
			? normalizeComparableMatchValue(sanitized, options)
			: null;
	}

	if (typeof rawValue === "number" || typeof rawValue === "boolean") {
		return normalizeComparableMatchValue(String(rawValue), options);
	}

	if (Array.isArray(rawValue)) {
		const flattened = rawValue
			.map((value) => {
				if (typeof value === "string") {
					return sanitizeTextValue(value, { maxLength: 120 });
				}

				if (typeof value === "number" || typeof value === "boolean") {
					return String(value);
				}

				return null;
			})
			.filter((value) => Boolean(value))
			.join(" ");

		if (!flattened) {
			return null;
		}

		return normalizeComparableMatchValue(flattened, options);
	}

	return null;
}

export function readComparableDynamicFieldValueByLabel(params: {
	dynamicFieldSchema: Prisma.JsonValue | null;
	dynamicFieldValues: Prisma.JsonValue | null;
	fieldLabelNormalized: string;
	ignoreLeadingZerosForNumeric?: boolean;
}) {
	const schema = parseSaleDynamicFieldSchemaJson(params.dynamicFieldSchema);
	const values = parseSaleDynamicFieldValuesJson(params.dynamicFieldValues);

	const matchedField = schema.find((field) => {
		return normalizeMatchValue(field.label) === params.fieldLabelNormalized;
	});

	if (!matchedField) {
		return null;
	}

	return coerceDynamicValueToComparableText(values[matchedField.fieldId], {
		ignoreLeadingZerosForNumeric: params.ignoreLeadingZerosForNumeric,
	});
}
