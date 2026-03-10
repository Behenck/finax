import { format, parse, parseISO } from "date-fns";
import {
	type SaleDynamicFieldOption,
	type SaleDynamicFieldSchemaItem,
	type SaleDynamicFieldType,
	type SaleDynamicFieldValues,
} from "@/schemas/types/sale-dynamic-fields";
import { formatCurrencyBRL, parseBRLCurrencyToCents } from "@/utils/format-amount";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export type SaleDynamicFieldHistoryValue = {
	fieldId: string;
	label: string;
	type: SaleDynamicFieldType;
	options: SaleDynamicFieldOption[];
	value: unknown | null;
};

function isDateOnlyString(value: string) {
	return DATE_ONLY_REGEX.test(value);
}

function isIsoDateTimeString(value: string) {
	return ISO_DATE_TIME_REGEX.test(value);
}

export function sanitizeRichTextHtml(value: string) {
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

export function stripRichTextTags(value: string) {
	return value
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function isRichTextEmpty(value: string) {
	return stripRichTextTags(value).length === 0;
}

function normalizeDateInputValue(value: unknown) {
	if (typeof value !== "string") {
		return "";
	}

	const normalized = value.trim();
	if (!normalized || !isDateOnlyString(normalized)) {
		return "";
	}

	return normalized;
}

function normalizeDateTimeInputValue(value: unknown) {
	if (typeof value !== "string") {
		return "";
	}

	const normalized = value.trim();
	if (!normalized) {
		return "";
	}

	const parsed = new Date(normalized);
	if (Number.isNaN(parsed.getTime())) {
		return "";
	}

	return format(parsed, "yyyy-MM-dd'T'HH:mm");
}

export function toSaleDynamicFieldFormValues(
	schema: SaleDynamicFieldSchemaItem[],
	values: SaleDynamicFieldValues,
) {
	const formValues: Record<string, unknown> = {};

	for (const field of schema) {
		const rawValue = values[field.fieldId];

		if (field.type === "NUMBER") {
			formValues[field.fieldId] =
				typeof rawValue === "number" && Number.isFinite(rawValue)
					? String(rawValue)
					: "";
			continue;
		}

		if (field.type === "CURRENCY") {
			formValues[field.fieldId] =
				typeof rawValue === "number" && Number.isFinite(rawValue)
					? formatCurrencyBRL(rawValue / 100)
					: "";
			continue;
		}

		if (field.type === "MULTI_SELECT") {
			formValues[field.fieldId] = Array.isArray(rawValue)
				? rawValue.filter((item) => typeof item === "string")
				: [];
			continue;
		}

		if (field.type === "DATE") {
			formValues[field.fieldId] = normalizeDateInputValue(rawValue);
			continue;
		}

		if (field.type === "DATE_TIME") {
			formValues[field.fieldId] = normalizeDateTimeInputValue(rawValue);
			continue;
		}

		formValues[field.fieldId] = typeof rawValue === "string" ? rawValue : "";
	}

	return formValues;
}

function normalizeSelectFieldValue(value: unknown) {
	if (typeof value !== "string") {
		return null;
	}

	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
}

function normalizeTextFieldValue(value: unknown) {
	if (typeof value !== "string") {
		return null;
	}

	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
}

function normalizeNumberFieldValue(value: unknown) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string") {
		const normalized = value.trim().replace(/,/g, ".");
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

function normalizeDateFieldValue(value: unknown) {
	if (typeof value !== "string") {
		return null;
	}

	const normalized = value.trim();
	return isDateOnlyString(normalized) ? normalized : null;
}

function normalizeDateTimeFieldValue(value: unknown) {
	if (typeof value !== "string") {
		return null;
	}

	const normalized = value.trim();
	if (!normalized) {
		return null;
	}

	const parsed = new Date(normalized);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed.toISOString();
}

function normalizeMultiSelectFieldValue(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	const uniqueValues = new Set<string>();
	for (const item of value) {
		if (typeof item !== "string") {
			continue;
		}
		const normalized = item.trim();
		if (!normalized) {
			continue;
		}
		uniqueValues.add(normalized);
	}

	return Array.from(uniqueValues);
}

function normalizeCurrencyFieldValue(value: unknown) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.round(value);
	}

	if (typeof value === "string") {
		const normalized = value.trim();
		if (!normalized) {
			return null;
		}

		return parseBRLCurrencyToCents(normalized);
	}

	return null;
}

function normalizePhoneFieldValue(value: unknown) {
	if (typeof value !== "string") {
		return null;
	}

	const digits = value.replace(/\D/g, "");
	return digits.length > 0 ? digits : null;
}

function normalizeRichTextFieldValue(value: unknown) {
	if (typeof value !== "string") {
		return null;
	}

	const sanitized = sanitizeRichTextHtml(value);
	if (!sanitized || isRichTextEmpty(sanitized)) {
		return null;
	}

	return sanitized;
}

export function toSaleDynamicFieldPayloadValues(
	schema: SaleDynamicFieldSchemaItem[],
	formValues: Record<string, unknown>,
) {
	const payload: Record<string, unknown> = {};

	for (const field of schema) {
		const rawValue = formValues[field.fieldId];

		if (field.type === "TEXT") {
			payload[field.fieldId] = normalizeTextFieldValue(rawValue);
			continue;
		}

		if (field.type === "PHONE") {
			payload[field.fieldId] = normalizePhoneFieldValue(rawValue);
			continue;
		}

		if (field.type === "RICH_TEXT") {
			payload[field.fieldId] = normalizeRichTextFieldValue(rawValue);
			continue;
		}

		if (field.type === "NUMBER") {
			payload[field.fieldId] = normalizeNumberFieldValue(rawValue);
			continue;
		}

		if (field.type === "CURRENCY") {
			payload[field.fieldId] = normalizeCurrencyFieldValue(rawValue);
			continue;
		}

		if (field.type === "SELECT") {
			payload[field.fieldId] = normalizeSelectFieldValue(rawValue);
			continue;
		}

		if (field.type === "MULTI_SELECT") {
			payload[field.fieldId] = normalizeMultiSelectFieldValue(rawValue);
			continue;
		}

		if (field.type === "DATE") {
			payload[field.fieldId] = normalizeDateFieldValue(rawValue);
			continue;
		}

		if (field.type === "DATE_TIME") {
			payload[field.fieldId] = normalizeDateTimeFieldValue(rawValue);
			continue;
		}
	}

	return payload;
}

function formatDynamicFieldDate(value: string) {
	return format(parse(value, "yyyy-MM-dd", new Date()), "dd/MM/yyyy");
}

function formatDynamicFieldDateTime(value: string) {
	return format(parseISO(value), "dd/MM/yyyy HH:mm");
}

function resolveOptionLabel(options: SaleDynamicFieldOption[], optionId: string) {
	return options.find((option) => option.id === optionId)?.label ?? optionId;
}

function formatStringValue(value: unknown) {
	if (value === null || value === undefined) {
		return "vazio";
	}

	if (typeof value === "string") {
		const normalized = value.trim();
		if (!normalized) {
			return "vazio";
		}

		if (isDateOnlyString(normalized)) {
			return formatDynamicFieldDate(normalized);
		}

		if (isIsoDateTimeString(normalized)) {
			return formatDynamicFieldDateTime(normalized);
		}

		return normalized;
	}

	if (typeof value === "number") {
		return new Intl.NumberFormat("pt-BR").format(value);
	}

	if (typeof value === "boolean") {
		return value ? "sim" : "não";
	}

	if (Array.isArray(value)) {
		return value.length > 0 ? value.join(", ") : "vazio";
	}

	if (typeof value === "object") {
		return JSON.stringify(value);
	}

	return String(value);
}

export function formatSaleDynamicFieldValue(
	field: Pick<SaleDynamicFieldSchemaItem, "type" | "options">,
	value: unknown | null,
) {
	if (value === null || value === undefined) {
		return "vazio";
	}

	if (field.type === "CURRENCY") {
		if (typeof value !== "number") {
			return "vazio";
		}
		return formatCurrencyBRL(value / 100);
	}

	if (field.type === "NUMBER") {
		if (typeof value !== "number") {
			return "vazio";
		}
		return new Intl.NumberFormat("pt-BR", {
			maximumFractionDigits: 4,
		}).format(value);
	}

	if (field.type === "SELECT") {
		if (typeof value !== "string") {
			return "vazio";
		}
		return resolveOptionLabel(field.options, value);
	}

	if (field.type === "MULTI_SELECT") {
		if (!Array.isArray(value)) {
			return "vazio";
		}

		const selectedOptions = value
			.filter((option) => typeof option === "string")
			.map((option) => resolveOptionLabel(field.options, option));
		return selectedOptions.length > 0 ? selectedOptions.join(", ") : "vazio";
	}

	if (field.type === "DATE") {
		if (typeof value !== "string" || !isDateOnlyString(value)) {
			return "vazio";
		}
		return formatDynamicFieldDate(value);
	}

	if (field.type === "DATE_TIME") {
		if (typeof value !== "string") {
			return "vazio";
		}

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) {
			return "vazio";
		}

		return formatDynamicFieldDateTime(parsed.toISOString());
	}

	if (field.type === "RICH_TEXT") {
		if (typeof value !== "string") {
			return "vazio";
		}

		const sanitized = sanitizeRichTextHtml(value);
		return isRichTextEmpty(sanitized) ? "vazio" : stripRichTextTags(sanitized);
	}

	return formatStringValue(value);
}

export function formatSaleDynamicFieldRichTextHtml(value: unknown | null) {
	if (typeof value !== "string") {
		return "";
	}

	const sanitized = sanitizeRichTextHtml(value);
	if (isRichTextEmpty(sanitized)) {
		return "";
	}

	return sanitized;
}

export function isSaleDynamicFieldHistoryValue(
	value: unknown,
): value is SaleDynamicFieldHistoryValue {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const recordValue = value as Record<string, unknown>;
	return (
		typeof recordValue.fieldId === "string" &&
		typeof recordValue.label === "string" &&
		typeof recordValue.type === "string" &&
		Array.isArray(recordValue.options) &&
		"value" in recordValue
	);
}
