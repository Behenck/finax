import type { Prisma } from "generated/prisma/client";
import { SaleDynamicFieldType } from "generated/prisma/enums";
import { BadRequestError } from "../_errors/bad-request-error";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const DYNAMIC_FIELD_TYPE_VALUES = new Set<string>(Object.values(SaleDynamicFieldType));

export type SaleDynamicFieldOptionSnapshot = {
	id: string;
	label: string;
};

export type SaleDynamicFieldSchemaItem = {
	fieldId: string;
	label: string;
	type: SaleDynamicFieldType;
	required: boolean;
	options: SaleDynamicFieldOptionSnapshot[];
};

export type SaleDynamicFieldSchemaSnapshot = SaleDynamicFieldSchemaItem[];

export type SaleDynamicFieldValuesSnapshot = Record<string, unknown | null>;

export type SaleDynamicFieldHistoryValue = {
	fieldId: string;
	label: string;
	type: SaleDynamicFieldType;
	options: SaleDynamicFieldOptionSnapshot[];
	value: unknown | null;
};

type SaleDynamicFieldDbClient = Pick<
	Prisma.TransactionClient,
	"product" | "productSaleField"
>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSnapshotOption(value: unknown): SaleDynamicFieldOptionSnapshot | null {
	if (!isPlainObject(value)) {
		return null;
	}

	if (typeof value.id !== "string" || typeof value.label !== "string") {
		return null;
	}

	return {
		id: value.id,
		label: value.label,
	};
}

function normalizeSnapshotField(value: unknown): SaleDynamicFieldSchemaItem | null {
	if (!isPlainObject(value)) {
		return null;
	}

	if (
		typeof value.fieldId !== "string" ||
		typeof value.label !== "string" ||
		typeof value.required !== "boolean" ||
		typeof value.type !== "string" ||
		!DYNAMIC_FIELD_TYPE_VALUES.has(value.type)
	) {
		return null;
	}

	const options = Array.isArray(value.options)
		? value.options
				.map(normalizeSnapshotOption)
				.filter((option) => option !== null)
		: [];

	return {
		fieldId: value.fieldId,
		label: value.label,
		type: value.type as SaleDynamicFieldType,
		required: value.required,
		options,
	};
}

function parseDateOnlyInput(value: string) {
	if (!DATE_ONLY_REGEX.test(value)) {
		return null;
	}

	const parsed = new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	if (parsed.toISOString().slice(0, 10) !== value) {
		return null;
	}

	return value;
}

function sanitizeRichTextHtml(value: string) {
	const normalized = value.trim();
	if (!normalized) {
		return "";
	}

	return normalized
		.replace(/<\s*(script|style|iframe|object|embed|meta|link)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
		.replace(/<\s*(script|style|iframe|object|embed|meta|link)[^>]*\/?>/gi, "")
		.replace(/<!--([\s\S]*?)-->/g, "")
		.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.replace(/\s(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, "");
}

function isRichTextEmpty(value: string) {
	const plainText = value
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/\s+/g, " ")
		.trim();

	return plainText.length === 0;
}

function parseCurrencyToCents(rawValue: string) {
	const normalized = rawValue.trim();
	if (!normalized) {
		return null;
	}

	if (/^\d+$/.test(normalized)) {
		return Number(normalized);
	}

	const formatted = normalized
		.replace(/\./g, "")
		.replace(/,/g, ".")
		.replace(/[^\d.-]/g, "");

	if (!formatted) {
		return null;
	}

	const parsed = Number(formatted);
	if (!Number.isFinite(parsed)) {
		return null;
	}

	return Math.round((parsed + Number.EPSILON) * 100);
}

function normalizeNumberValue(rawValue: unknown) {
	if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
		return rawValue;
	}

	if (typeof rawValue === "string") {
		const normalized = rawValue.trim().replace(/,/g, ".");
		if (!normalized) {
			return null;
		}
		const parsed = Number(normalized);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}

	return null;
}

function normalizeTextValue(rawValue: unknown) {
	if (typeof rawValue !== "string") {
		return null;
	}

	const normalized = rawValue.trim();
	return normalized.length > 0 ? normalized : null;
}

function normalizePhoneValue(rawValue: unknown) {
	if (typeof rawValue !== "string") {
		return null;
	}

	const digits = rawValue.replace(/\D/g, "");
	return digits.length > 0 ? digits : null;
}

function normalizeRichTextValue(rawValue: unknown) {
	if (typeof rawValue !== "string") {
		return null;
	}

	const sanitized = sanitizeRichTextHtml(rawValue);
	if (!sanitized || isRichTextEmpty(sanitized)) {
		return null;
	}

	return sanitized;
}

function normalizeSelectValue(
	field: SaleDynamicFieldSchemaItem,
	rawValue: unknown,
) {
	if (typeof rawValue !== "string") {
		return null;
	}

	const normalized = rawValue.trim();
	if (!normalized) {
		return null;
	}

	const validOptionIds = new Set(field.options.map((option) => option.id));
	if (!validOptionIds.has(normalized)) {
		throw new BadRequestError(
			`Invalid option for dynamic field \"${field.label}\"`,
		);
	}

	return normalized;
}

function normalizeMultiSelectValue(
	field: SaleDynamicFieldSchemaItem,
	rawValue: unknown,
) {
	if (!Array.isArray(rawValue)) {
		return null;
	}

	const validOptionIds = new Set(field.options.map((option) => option.id));
	const uniqueValues: string[] = [];
	const alreadyAdded = new Set<string>();

	for (const item of rawValue) {
		if (typeof item !== "string") {
			throw new BadRequestError(
				`Invalid multi-selection value for dynamic field \"${field.label}\"`,
			);
		}

		const normalized = item.trim();
		if (!normalized) {
			continue;
		}

		if (!validOptionIds.has(normalized)) {
			throw new BadRequestError(
				`Invalid option for dynamic field \"${field.label}\"`,
			);
		}

		if (alreadyAdded.has(normalized)) {
			continue;
		}

		alreadyAdded.add(normalized);
		uniqueValues.push(normalized);
	}

	return uniqueValues;
}

function normalizeDateValue(rawValue: unknown) {
	if (typeof rawValue !== "string") {
		return null;
	}

	const normalized = rawValue.trim();
	if (!normalized) {
		return null;
	}

	return parseDateOnlyInput(normalized);
}

function normalizeDateTimeValue(rawValue: unknown) {
	if (rawValue instanceof Date) {
		if (Number.isNaN(rawValue.getTime())) {
			return null;
		}

		return rawValue.toISOString();
	}

	if (typeof rawValue !== "string") {
		return null;
	}

	const normalized = rawValue.trim();
	if (!normalized) {
		return null;
	}

	const parsed = new Date(normalized);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed.toISOString();
}

function normalizeDynamicFieldValue(
	field: SaleDynamicFieldSchemaItem,
	rawValue: unknown,
): unknown | null {
	if (rawValue === undefined || rawValue === null) {
		return null;
	}

	if (field.type === SaleDynamicFieldType.TEXT) {
		return normalizeTextValue(rawValue);
	}

	if (field.type === SaleDynamicFieldType.PHONE) {
		return normalizePhoneValue(rawValue);
	}

	if (field.type === SaleDynamicFieldType.RICH_TEXT) {
		return normalizeRichTextValue(rawValue);
	}

	if (field.type === SaleDynamicFieldType.NUMBER) {
		return normalizeNumberValue(rawValue);
	}

	if (field.type === SaleDynamicFieldType.CURRENCY) {
		if (typeof rawValue === "number" && Number.isInteger(rawValue)) {
			return rawValue;
		}

		if (typeof rawValue === "string") {
			return parseCurrencyToCents(rawValue);
		}

		return null;
	}

	if (field.type === SaleDynamicFieldType.SELECT) {
		return normalizeSelectValue(field, rawValue);
	}

	if (field.type === SaleDynamicFieldType.MULTI_SELECT) {
		return normalizeMultiSelectValue(field, rawValue);
	}

	if (field.type === SaleDynamicFieldType.DATE) {
		return normalizeDateValue(rawValue);
	}

	if (field.type === SaleDynamicFieldType.DATE_TIME) {
		return normalizeDateTimeValue(rawValue);
	}

	return null;
}

function assertRequiredValue(
	field: SaleDynamicFieldSchemaItem,
	value: unknown | null,
) {
	if (!field.required) {
		return;
	}

	if (value === null || value === undefined) {
		throw new BadRequestError(
			`Dynamic field \"${field.label}\" is required`,
		);
	}

	if (typeof value === "string" && value.trim().length === 0) {
		throw new BadRequestError(
			`Dynamic field \"${field.label}\" is required`,
		);
	}

	if (Array.isArray(value) && value.length === 0) {
		throw new BadRequestError(
			`Dynamic field \"${field.label}\" is required`,
		);
	}
}

export async function loadProductSaleFieldSchema(
	client: SaleDynamicFieldDbClient,
	productId: string,
): Promise<SaleDynamicFieldSchemaSnapshot> {
	const lineageProductIds: string[] = [];
	const visitedProductIds = new Set<string>();
	let currentProductId: string | null = productId;

	while (currentProductId) {
		if (visitedProductIds.has(currentProductId)) {
			break;
		}
		visitedProductIds.add(currentProductId);

		const product: { id: string; parentId: string | null } | null =
			await client.product.findUnique({
				where: {
					id: currentProductId,
				},
				select: {
					id: true,
					parentId: true,
				},
			});

		if (!product) {
			break;
		}

		lineageProductIds.unshift(product.id);
		currentProductId = product.parentId;
	}

	if (lineageProductIds.length === 0) {
		return [];
	}

	const fieldsByProduct = await Promise.all(
		lineageProductIds.map((lineageProductId) =>
			client.productSaleField.findMany({
				where: {
					productId: lineageProductId,
				},
				orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
				select: {
					id: true,
					label: true,
					labelNormalized: true,
					type: true,
					required: true,
					options: {
						orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
						select: {
							id: true,
							label: true,
						},
					},
				},
			}),
			),
	);

	const mergedFields = new Map<string, SaleDynamicFieldSchemaItem>();
	for (const fields of fieldsByProduct) {
		for (const field of fields) {
			// Child field overrides parent when labels are equal.
			if (mergedFields.has(field.labelNormalized)) {
				mergedFields.delete(field.labelNormalized);
			}

			mergedFields.set(field.labelNormalized, {
				fieldId: field.id,
				label: field.label,
				type: field.type,
				required: field.required,
				options: field.options,
			});
		}
	}

	return Array.from(mergedFields.values());
}

export function parseSaleDynamicFieldSchemaJson(
	value: Prisma.JsonValue | null | undefined,
): SaleDynamicFieldSchemaSnapshot {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map(normalizeSnapshotField)
		.filter((field) => field !== null);
}

export function parseSaleDynamicFieldValuesJson(
	value: Prisma.JsonValue | null | undefined,
): SaleDynamicFieldValuesSnapshot {
	if (!isPlainObject(value)) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(value).map(([fieldId, fieldValue]) => [fieldId, fieldValue ?? null]),
	);
}

export function normalizeSaleDynamicFieldValues(params: {
	schema: SaleDynamicFieldSchemaSnapshot;
	input: Record<string, unknown> | undefined;
}): SaleDynamicFieldValuesSnapshot {
	const inputValues = params.input ?? {};
	const fieldIds = new Set(params.schema.map((field) => field.fieldId));

	for (const fieldId of Object.keys(inputValues)) {
		if (!fieldIds.has(fieldId)) {
			throw new BadRequestError(`Unknown dynamic field: ${fieldId}`);
		}
	}

	const normalizedValues: SaleDynamicFieldValuesSnapshot = {};

	for (const field of params.schema) {
		const rawValue = inputValues[field.fieldId];
		const normalizedValue = normalizeDynamicFieldValue(field, rawValue);

		if (field.type === SaleDynamicFieldType.DATE && rawValue !== undefined && normalizedValue === null) {
			throw new BadRequestError(
				`Invalid date value for dynamic field \"${field.label}\"`,
			);
		}

		if (
			field.type === SaleDynamicFieldType.DATE_TIME &&
			rawValue !== undefined &&
			normalizedValue === null
		) {
			throw new BadRequestError(
				`Invalid date-time value for dynamic field \"${field.label}\"`,
			);
		}

		if (
			(field.type === SaleDynamicFieldType.NUMBER ||
				field.type === SaleDynamicFieldType.CURRENCY) &&
			rawValue !== undefined &&
			normalizedValue === null
		) {
			throw new BadRequestError(
				`Invalid numeric value for dynamic field \"${field.label}\"`,
			);
		}

		assertRequiredValue(field, normalizedValue);
		normalizedValues[field.fieldId] = normalizedValue;
	}

	return normalizedValues;
}

export function buildSaleDynamicFieldHistoryValues(
	schema: SaleDynamicFieldSchemaSnapshot,
	values: SaleDynamicFieldValuesSnapshot,
): Record<string, SaleDynamicFieldHistoryValue> {
	const schemaByFieldId = new Map(schema.map((field) => [field.fieldId, field]));
	const entries: Record<string, SaleDynamicFieldHistoryValue> = {};

	for (const field of schema) {
		entries[field.fieldId] = {
			fieldId: field.fieldId,
			label: field.label,
			type: field.type,
			options: field.options,
			value:
				Object.prototype.hasOwnProperty.call(values, field.fieldId)
					? (values[field.fieldId] ?? null)
					: null,
		};
	}

	for (const [fieldId, fieldValue] of Object.entries(values)) {
		if (entries[fieldId]) {
			continue;
		}

		const fallbackField = schemaByFieldId.get(fieldId);
		entries[fieldId] = {
			fieldId,
			label: fallbackField?.label ?? fieldId,
			type: fallbackField?.type ?? SaleDynamicFieldType.TEXT,
			options: fallbackField?.options ?? [],
			value: fieldValue,
		};
	}

	return entries;
}
