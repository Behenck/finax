import { Link } from "@tanstack/react-router";
import {
	AlertCircle,
	CheckCircle2,
	FileSpreadsheet,
	Loader2,
	Save,
	Trash2,
	Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useApp } from "@/context/app-context";
import {
	useCreateSaleImportTemplate,
	useDeleteSaleImportTemplate,
	useExecuteSaleImport,
	useSaleFormOptions,
	useSaleImportTemplates,
	useUpdateSaleImportTemplate,
} from "@/hooks/sales";
import { useGetOrganizationsSlugProductsIdSaleFields } from "@/http/generated";
import type {
	SaleImportDynamicProductMapping,
	SaleImportFailure,
	SaleImportFieldMapping,
	SaleImportFixedValues,
	SaleImportMapping,
	SaleImportResult,
	SaleImportTemplate,
} from "@/schemas/types/sale-import";
import {
	MAX_IMPORT_ROWS,
	type ParsedImportFile,
	parseSpreadsheetFile,
} from "./utils";

type WizardStep = "UPLOAD" | "MAPPING" | "FINALIZATION" | "RESULT";

const NONE_VALUE = "__NONE__";
const PRODUCT_MATCH_TOKEN_REGEX = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu;
const FINALIZATION_PAGE_SIZE = 50;

interface FailedImportSourceRow {
	originalRowNumber: number;
	rowData: Record<string, unknown>;
}

interface FailedImportRowDraft {
	originalRowNumber: number;
	rowData: Record<string, unknown>;
	excelFieldValue: string | null;
	failure: SaleImportFailure;
	shouldRetry: boolean;
}

interface ImportProgressSummary {
	totalRows: number;
	importedRows: number;
}

interface FinalizationPreviewColumn {
	key: string;
	label: string;
}

interface FinalizationRowDraft {
	rowNumber: number;
	rowData: Record<string, unknown>;
	selectedForImport: boolean;
	validationErrors: string[];
}

type FailedRowEditorType = "NONE" | "PRODUCT" | "TOTAL_AMOUNT" | "TEXT";

interface ProductSuggestionOption {
	id: string;
	label: string;
	name: string;
}

const REQUIRED_FIELD_CONFIG: Array<{
	key: keyof SaleImportFieldMapping;
	label: string;
	help: string;
	required: boolean;
}> = [
	{
		key: "saleDateColumn",
		label: "Data da venda",
		help: "Campo obrigatório",
		required: true,
	},
	{
		key: "totalAmountColumn",
		label: "Valor total",
		help: "Campo obrigatório",
		required: true,
	},
	{
		key: "productColumn",
		label: "Produto/descrição (Excel)",
		help: "Opcional. Se informado, tenta achar filho do produto selecionado",
		required: false,
	},
	{
		key: "customerNameColumn",
		label: "Nome do cliente",
		help: "Campo obrigatório",
		required: true,
	},
	{
		key: "customerDocumentColumn",
		label: "Documento do cliente",
		help: "Campo obrigatório",
		required: true,
	},
	{
		key: "customerEmailColumn",
		label: "E-mail do cliente",
		help: "Opcional",
		required: false,
	},
	{
		key: "customerPhoneColumn",
		label: "Telefone do cliente",
		help: "Opcional",
		required: false,
	},
	{
		key: "notesColumn",
		label: "Observações",
		help: "Opcional",
		required: false,
	},
];

function normalizeHeaderKey(value: string) {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.trim();
}

function findHeaderByKeywords(headers: string[], keywords: string[]) {
	const normalizedHeaders = headers.map((header) => ({
		raw: header,
		normalized: normalizeHeaderKey(header),
	}));

	for (const keyword of keywords) {
		const normalizedKeyword = normalizeHeaderKey(keyword);
		const match = normalizedHeaders.find((header) =>
			header.normalized.includes(normalizedKeyword),
		);
		if (match) {
			return match.raw;
		}
	}

	return "";
}

function findOptionalHeaderByKeywords(headers: string[], keywords: string[]) {
	const header = findHeaderByKeywords(headers, keywords);
	return header || undefined;
}

function normalizeOptionalColumnKey(columnKey: string | undefined) {
	const normalized = columnKey?.trim();
	return normalized ? normalized : undefined;
}

function normalizeOptionalValue(value: string | undefined) {
	const normalized = value?.trim();
	return normalized ? normalized : undefined;
}

function resolveSingleDynamicByProduct(params: {
	selectedProductId: string;
	dynamicByProduct: SaleImportDynamicProductMapping[];
}) {
	const currentForSelected = params.dynamicByProduct.find(
		(dynamicMapping) => dynamicMapping.productId === params.selectedProductId,
	);

	return currentForSelected
		? [currentForSelected]
		: [
				{
					productId: params.selectedProductId,
					fields: [],
				},
			];
}

function normalizeTemplateForSingleProduct(template: SaleImportTemplate) {
	const resolvedSelectedProductId =
		template.fixedValues.parentProductId ||
		template.mapping.dynamicByProduct[0]?.productId ||
		"";

	return {
		fields: template.mapping.fields,
		fixedValues: {
			...template.fixedValues,
			parentProductId: resolvedSelectedProductId,
		},
		dynamicByProduct: resolvedSelectedProductId
			? resolveSingleDynamicByProduct({
					selectedProductId: resolvedSelectedProductId,
					dynamicByProduct: template.mapping.dynamicByProduct,
				})
			: [],
	};
}

function normalizeMappingForRequest(
	mapping: SaleImportMapping,
): SaleImportMapping {
	const normalizedSelectedProductId = normalizeOptionalValue(
		mapping.fixedValues.parentProductId,
	);
	const normalizedDynamicByProduct = normalizedSelectedProductId
		? resolveSingleDynamicByProduct({
				selectedProductId: normalizedSelectedProductId,
				dynamicByProduct: mapping.dynamicByProduct,
			})
		: [];

	return {
		...mapping,
		fields: {
			...mapping.fields,
			productColumn: normalizeOptionalColumnKey(mapping.fields.productColumn),
			notesColumn: normalizeOptionalColumnKey(mapping.fields.notesColumn),
			customerEmailColumn: normalizeOptionalColumnKey(
				mapping.fields.customerEmailColumn,
			),
			customerPhoneColumn: normalizeOptionalColumnKey(
				mapping.fields.customerPhoneColumn,
			),
		},
		dynamicByProduct: normalizedDynamicByProduct.map((dynamicMapping) => ({
			...dynamicMapping,
			fields: dynamicMapping.fields.map((fieldMapping) => ({
				fieldId: fieldMapping.fieldId,
				columnKey: fieldMapping.columnKey,
			})),
		})),
		fixedValues: {
			...mapping.fixedValues,
			parentProductId: normalizedSelectedProductId ?? "",
		},
	};
}

function stringifyImportCellValue(value: unknown) {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	return String(value);
}

function normalizeSearchValue(value: string) {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.normalize("NFKC")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}

function tokenizeSearchValue(value: string) {
	const normalized = normalizeSearchValue(value);
	if (!normalized) {
		return [];
	}

	const tokenMatches = normalized.match(PRODUCT_MATCH_TOKEN_REGEX) ?? [];
	const tokens = new Set<string>();

	for (const matchedToken of tokenMatches) {
		const token = matchedToken.trim();
		if (!token) {
			continue;
		}

		tokens.add(token);
		if (!token.includes("-")) {
			continue;
		}

		const parts = token
			.split("-")
			.map((part) => part.trim())
			.filter((part) => part.length > 0);
		for (const part of parts) {
			tokens.add(part);
		}
	}

	return Array.from(tokens);
}

function computeProductMatch(
	rawValue: string,
	option: ProductSuggestionOption,
) {
	const normalizedRawValue = normalizeSearchValue(rawValue);
	if (!normalizedRawValue) {
		return {
			score: 0,
			exactTokenMatches: 0,
		};
	}

	const optionSearchBase = `${option.name} ${option.label}`;
	const normalizedOptionText = normalizeSearchValue(optionSearchBase);
	const rawTokens = tokenizeSearchValue(rawValue);
	const optionTokens = new Set(tokenizeSearchValue(optionSearchBase));
	const optionTokensArray = Array.from(optionTokens);

	let score = 0;
	if (normalizedOptionText === normalizedRawValue) {
		score += 120;
	}
	if (normalizedOptionText.includes(normalizedRawValue)) {
		score += 60;
	}

	let matchedTokens = 0;
	let exactTokenMatches = 0;
	for (const token of rawTokens) {
		if (optionTokens.has(token)) {
			score += 20;
			matchedTokens += 1;
			exactTokenMatches += 1;
			continue;
		}

		const hasPartialTokenMatch =
			token.length >= 3 &&
			optionTokensArray.some(
				(optionToken) =>
					optionToken.length >= 3 &&
					(optionToken.includes(token) || token.includes(optionToken)),
			);
		if (hasPartialTokenMatch) {
			score += 12;
			matchedTokens += 1;
		}
	}

	if (rawTokens.length > 0) {
		score += Math.round((matchedTokens / rawTokens.length) * 20);
	}

	return {
		score,
		exactTokenMatches,
	};
}

function findBestProductSuggestion(
	rawValue: string,
	productOptions: ProductSuggestionOption[],
) {
	const normalizedRawValue = normalizeSearchValue(rawValue);
	if (!normalizedRawValue) {
		return null;
	}

	const rankedOptions = productOptions
		.map((option) => ({
			option,
			match: computeProductMatch(rawValue, option),
		}))
		.filter((item) => item.match.score > 0 && item.match.exactTokenMatches > 0)
		.sort((itemA, itemB) => {
			if (itemA.match.score !== itemB.match.score) {
				return itemB.match.score - itemA.match.score;
			}
			const labelComparison = itemA.option.label.localeCompare(
				itemB.option.label,
			);
			if (labelComparison !== 0) {
				return labelComparison;
			}
			return itemA.option.id.localeCompare(itemB.option.id);
		});

	if (rankedOptions.length === 0) {
		return null;
	}

	return rankedOptions[0].option.id;
}

function sortProductOptionsByRelevance(params: {
	rawValue: string;
	productOptions: ProductSuggestionOption[];
}) {
	if (!params.rawValue.trim()) {
		return params.productOptions;
	}

	return params.productOptions
		.map((option) => ({
			option,
			match: computeProductMatch(params.rawValue, option),
		}))
		.sort((itemA, itemB) => {
			const scoreA = itemA.match.exactTokenMatches > 0 ? itemA.match.score : 0;
			const scoreB = itemB.match.exactTokenMatches > 0 ? itemB.match.score : 0;

			if (scoreA !== scoreB) {
				return scoreB - scoreA;
			}

			const labelComparison = itemA.option.label.localeCompare(
				itemB.option.label,
			);
			if (labelComparison !== 0) {
				return labelComparison;
			}
			return itemA.option.id.localeCompare(itemB.option.id);
		})
		.map((item) => item.option);
}

function getParentScopedProductOptions(params: {
	parentProductId?: string;
	productOptions: ProductSuggestionOption[];
}) {
	if (!params.parentProductId) {
		return params.productOptions;
	}

	const parentProduct = params.productOptions.find(
		(product) => product.id === params.parentProductId,
	);
	if (!parentProduct) {
		return params.productOptions;
	}

	const scopedOptions = params.productOptions.filter((product) => {
		if (product.id === parentProduct.id) {
			return true;
		}

		return product.label.startsWith(`${parentProduct.label} -> `);
	});

	return scopedOptions.length > 0 ? scopedOptions : [parentProduct];
}

function findBestChildSuggestionFromParent(params: {
	rawValue: string;
	parentProductId: string;
	productOptions: ProductSuggestionOption[];
}) {
	const parentOption = params.productOptions.find(
		(product) => product.id === params.parentProductId,
	);
	if (!parentOption) {
		return null;
	}

	const rawTokens = tokenizeSearchValue(params.rawValue);
	if (rawTokens.length === 0) {
		return null;
	}

	const parentTokens = new Set(
		tokenizeSearchValue(`${parentOption.name} ${parentOption.label}`),
	);
	const descendants = params.productOptions.filter((product) => {
		if (product.id === parentOption.id) {
			return false;
		}

		return product.label.startsWith(`${parentOption.label} -> `);
	});

	if (descendants.length === 0) {
		return null;
	}

	const rankedDescendants = descendants
		.map((descendant) => {
			const match = computeProductMatch(params.rawValue, descendant);
			const descendantTokens = new Set(
				tokenizeSearchValue(`${descendant.name} ${descendant.label}`),
			);
			const childSpecificExactTokenMatches = rawTokens.reduce(
				(total, token) => {
					if (descendantTokens.has(token) && !parentTokens.has(token)) {
						return total + 1;
					}

					return total;
				},
				0,
			);

			return {
				descendant,
				match,
				childSpecificExactTokenMatches,
			};
		})
		.filter(
			(item) =>
				item.match.score > 0 &&
				item.match.exactTokenMatches > 0 &&
				item.childSpecificExactTokenMatches > 0,
		)
		.sort((itemA, itemB) => {
			if (
				itemA.childSpecificExactTokenMatches !==
				itemB.childSpecificExactTokenMatches
			) {
				return (
					itemB.childSpecificExactTokenMatches -
					itemA.childSpecificExactTokenMatches
				);
			}

			if (itemA.match.score !== itemB.match.score) {
				return itemB.match.score - itemA.match.score;
			}

			const labelComparison = itemA.descendant.label.localeCompare(
				itemB.descendant.label,
			);
			if (labelComparison !== 0) {
				return labelComparison;
			}

			return itemA.descendant.id.localeCompare(itemB.descendant.id);
		});

	return rankedDescendants[0]?.descendant.id ?? null;
}

function findBestProductSuggestionWithinScope(params: {
	rawValue: string;
	parentProductId?: string;
	productOptions: ProductSuggestionOption[];
}) {
	if (!params.parentProductId) {
		return findBestProductSuggestion(params.rawValue, params.productOptions);
	}

	const parentExists = params.productOptions.some(
		(product) => product.id === params.parentProductId,
	);
	if (!parentExists) {
		return findBestProductSuggestion(params.rawValue, params.productOptions);
	}

	const scopedOptions = getParentScopedProductOptions({
		parentProductId: params.parentProductId,
		productOptions: params.productOptions,
	});
	const bestChild = findBestChildSuggestionFromParent({
		rawValue: params.rawValue,
		parentProductId: params.parentProductId,
		productOptions: scopedOptions,
	});

	return bestChild ?? params.parentProductId;
}

function parsePotentialAmountToCents(value: string) {
	const normalizedInput = value.trim();
	if (!normalizedInput) {
		return null;
	}

	const normalized = normalizedInput
		.replace(/\./g, "")
		.replace(/,/g, ".")
		.replace(/[^\d.-]/g, "");
	if (!normalized) {
		return null;
	}

	const parsedNumber = Number(normalized);
	if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
		return null;
	}

	return Math.round((parsedNumber + Number.EPSILON) * 100);
}

function parsePotentialSaleDate(value: unknown) {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value;
	}

	if (typeof value === "number" && Number.isFinite(value)) {
		const integerPart = Math.trunc(value);
		const fractionalPart = value - integerPart;
		const baseDate = Date.UTC(1899, 11, 30);
		const dateMs = baseDate + integerPart * 86_400_000;
		const timeMs = Math.round(fractionalPart * 86_400_000);
		const parsed = new Date(dateMs + timeMs);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}

	const rawValue = stringifyImportCellValue(value).trim();
	if (!rawValue) {
		return null;
	}

	const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (dateOnlyMatch) {
		const year = Number(dateOnlyMatch[1]);
		const month = Number(dateOnlyMatch[2]) - 1;
		const day = Number(dateOnlyMatch[3]);
		const parsed = new Date(Date.UTC(year, month, day));
		if (Number.isNaN(parsed.getTime())) {
			return null;
		}
		if (
			parsed.getUTCFullYear() !== year ||
			parsed.getUTCMonth() !== month ||
			parsed.getUTCDate() !== day
		) {
			return null;
		}
		return parsed;
	}

	const brDateMatch = rawValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
	if (brDateMatch) {
		const day = Number(brDateMatch[1]);
		const month = Number(brDateMatch[2]) - 1;
		const year = Number(brDateMatch[3]);
		const parsed = new Date(Date.UTC(year, month, day));
		if (Number.isNaN(parsed.getTime())) {
			return null;
		}
		if (
			parsed.getUTCFullYear() !== year ||
			parsed.getUTCMonth() !== month ||
			parsed.getUTCDate() !== day
		) {
			return null;
		}
		return parsed;
	}

	const timestamp = Date.parse(rawValue);
	if (!Number.isNaN(timestamp)) {
		return new Date(timestamp);
	}

	return null;
}

function buildFinalizationPreviewColumns(mapping: SaleImportMapping) {
	const columns: FinalizationPreviewColumn[] = [];
	const seenColumnKeys = new Set<string>();
	const fieldLabelByKey = new Map(
		REQUIRED_FIELD_CONFIG.map((fieldConfig) => [fieldConfig.key, fieldConfig.label]),
	);

	const orderedStandardKeys: Array<keyof SaleImportFieldMapping> = [
		"saleDateColumn",
		"totalAmountColumn",
		"productColumn",
		"customerNameColumn",
		"customerDocumentColumn",
		"customerEmailColumn",
		"customerPhoneColumn",
		"notesColumn",
	];

	for (const fieldKey of orderedStandardKeys) {
		const columnKey = mapping.fields[fieldKey];
		if (!columnKey || seenColumnKeys.has(columnKey)) {
			continue;
		}

		columns.push({
			key: columnKey,
			label: fieldLabelByKey.get(fieldKey) ?? columnKey,
		});
		seenColumnKeys.add(columnKey);
	}

	const selectedDynamicMapping = mapping.dynamicByProduct[0];
	for (const fieldMapping of selectedDynamicMapping?.fields ?? []) {
		if (
			!fieldMapping.columnKey ||
			seenColumnKeys.has(fieldMapping.columnKey)
		) {
			continue;
		}

		columns.push({
			key: fieldMapping.columnKey,
			label: `Personalizado: ${fieldMapping.columnKey}`,
		});
		seenColumnKeys.add(fieldMapping.columnKey);
	}

	return columns;
}

function validateFinalizationRowDraft(params: {
	rowData: Record<string, unknown>;
	mapping: SaleImportMapping;
}) {
	const { rowData, mapping } = params;
	const validationErrors: string[] = [];

	const saleDateValue = stringifyImportCellValue(
		rowData[mapping.fields.saleDateColumn],
	).trim();
	if (!saleDateValue) {
		validationErrors.push("Data da venda obrigatória");
	} else if (!parsePotentialSaleDate(rowData[mapping.fields.saleDateColumn])) {
		validationErrors.push("Data da venda potencialmente inválida");
	}

	const totalAmountValue = stringifyImportCellValue(
		rowData[mapping.fields.totalAmountColumn],
	).trim();
	if (!totalAmountValue) {
		validationErrors.push("Valor total obrigatório");
	} else if (!parsePotentialAmountToCents(totalAmountValue)) {
		validationErrors.push("Valor total potencialmente inválido");
	}

	const customerNameValue = stringifyImportCellValue(
		rowData[mapping.fields.customerNameColumn],
	).trim();
	if (!customerNameValue) {
		validationErrors.push("Nome do cliente obrigatório");
	}

	const customerDocumentValue = stringifyImportCellValue(
		rowData[mapping.fields.customerDocumentColumn],
	).trim();
	if (!customerDocumentValue) {
		validationErrors.push("Documento do cliente obrigatório");
	}

	return validationErrors;
}

function buildFinalizationRowData(params: {
	sourceRowData: Record<string, unknown>;
	columns: FinalizationPreviewColumn[];
	mapping: SaleImportMapping;
	productOptions: ProductSuggestionOption[];
}) {
	const rowData: Record<string, unknown> = {};

	for (const column of params.columns) {
		rowData[column.key] = params.sourceRowData[column.key];
	}

	const productColumn = params.mapping.fields.productColumn;
	if (!productColumn || !(productColumn in rowData)) {
		return rowData;
	}

	const parentProductId = params.mapping.fixedValues.parentProductId;
	const rawProductValue = stringifyImportCellValue(rowData[productColumn]).trim();

	const resolvedProductId = rawProductValue
		? findBestProductSuggestionWithinScope({
				rawValue: rawProductValue,
				parentProductId,
				productOptions: params.productOptions,
			})
		: parentProductId;

	if (!resolvedProductId) {
		rowData[productColumn] = rawProductValue;
		return rowData;
	}

	const resolvedProduct = params.productOptions.find(
		(product) => product.id === resolvedProductId,
	);
	rowData[productColumn] = resolvedProduct?.label ?? resolvedProductId;
	return rowData;
}

function buildFinalizationRowDrafts(params: {
	rows: Array<Record<string, unknown>>;
	mapping: SaleImportMapping;
	columns: FinalizationPreviewColumn[];
	productOptions: ProductSuggestionOption[];
}) {
	return params.rows.map((sourceRowData, rowIndex) => {
		const rowData = buildFinalizationRowData({
			sourceRowData,
			columns: params.columns,
			mapping: params.mapping,
			productOptions: params.productOptions,
		});
		const validationErrors = validateFinalizationRowDraft({
			rowData,
			mapping: params.mapping,
		});

		return {
			rowNumber: rowIndex + 1,
			rowData,
			validationErrors,
			selectedForImport: validationErrors.length === 0,
		} satisfies FinalizationRowDraft;
	});
}

function resolveFailedRowEditorType(params: {
	failedRow: FailedImportRowDraft;
	mapping: SaleImportMapping;
}) {
	const failureField = params.failedRow.failure.field;
	if (!failureField) {
		return "NONE" as const;
	}

	if (failureField === params.mapping.fields.productColumn) {
		return "PRODUCT" as const;
	}

	if (failureField === params.mapping.fields.totalAmountColumn) {
		return "TOTAL_AMOUNT" as const;
	}

	return "TEXT" as const;
}

function isCorrectionValueValid(
	editorType: FailedRowEditorType,
	value: string,
) {
	if (editorType === "NONE") {
		return false;
	}

	if (editorType === "PRODUCT" || editorType === "TEXT") {
		return value.trim().length > 0;
	}

	return parsePotentialAmountToCents(value) !== null;
}

function resolveProductSelectValue(params: {
	rowValue: unknown;
	productOptions: Array<{ id: string; label: string; name: string }>;
}) {
	const rawValue = stringifyImportCellValue(params.rowValue).trim();
	if (!rawValue) {
		return NONE_VALUE;
	}

	const exactIdMatch = params.productOptions.find(
		(option) => option.id === rawValue,
	);
	if (exactIdMatch) {
		return exactIdMatch.id;
	}

	const normalizedRawValue = normalizeSearchValue(rawValue);
	const byLabelMatch = params.productOptions.find(
		(option) => normalizeSearchValue(option.label) === normalizedRawValue,
	);
	if (byLabelMatch) {
		return byLabelMatch.id;
	}

	const byNameMatch = params.productOptions.find(
		(option) => normalizeSearchValue(option.name) === normalizedRawValue,
	);
	if (byNameMatch) {
		return byNameMatch.id;
	}

	return NONE_VALUE;
}

function buildFailedRowDrafts(params: {
	failures: SaleImportFailure[];
	sourceRows: FailedImportSourceRow[];
}) {
	const drafts: FailedImportRowDraft[] = [];

	for (const failure of params.failures) {
		const sourceRow = params.sourceRows[failure.rowNumber - 1];
		if (!sourceRow) {
			continue;
		}

		drafts.push({
			originalRowNumber: sourceRow.originalRowNumber,
			rowData: { ...sourceRow.rowData },
			excelFieldValue: failure.field
				? stringifyImportCellValue(sourceRow.rowData[failure.field])
				: null,
			failure: {
				...failure,
				rowNumber: sourceRow.originalRowNumber,
			},
			shouldRetry: false,
		});
	}

	return drafts;
}

function createInitialFieldMapping(headers: string[]): SaleImportFieldMapping {
	return {
		saleDateColumn: findHeaderByKeywords(headers, [
			"data",
			"sale_date",
			"venda",
		]),
		totalAmountColumn: findHeaderByKeywords(headers, [
			"valor",
			"total",
			"amount",
		]),
		productColumn: findOptionalHeaderByKeywords(headers, [
			"produto",
			"product",
			"descricao",
			"description",
		]),
		customerNameColumn: findHeaderByKeywords(headers, [
			"cliente",
			"customer",
			"nome",
		]),
		customerDocumentColumn: findHeaderByKeywords(headers, [
			"documento",
			"cpf",
			"cnpj",
		]),
		customerEmailColumn: findOptionalHeaderByKeywords(headers, [
			"email",
			"e-mail",
		]),
		customerPhoneColumn: findOptionalHeaderByKeywords(headers, [
			"telefone",
			"phone",
			"celular",
		]),
		notesColumn: findOptionalHeaderByKeywords(headers, [
			"observacao",
			"obs",
			"nota",
			"notes",
		]),
	};
}

function resolveInitialFixedValues(params: {
	companies: Array<{ id: string; units?: Array<{ id: string }> }>;
	products: Array<{ id: string }>;
}): SaleImportFixedValues {
	const companyId = params.companies[0]?.id ?? "";
	const unitId = params.companies[0]?.units?.[0]?.id;
	const parentProductId = params.products[0]?.id ?? "";

	return {
		companyId,
		unitId,
		parentProductId,
	};
}

function createInitialMapping(params: {
	headers: string[];
	companies: Array<{ id: string; units?: Array<{ id: string }> }>;
	products: Array<{ id: string }>;
}): SaleImportMapping {
	const fixedValues = resolveInitialFixedValues({
		companies: params.companies,
		products: params.products,
	});

	return {
		fields: createInitialFieldMapping(params.headers),
		fixedValues,
		dynamicByProduct: fixedValues.parentProductId
			? [
					{
						productId: fixedValues.parentProductId,
						fields: [],
					},
				]
			: [],
	};
}

function validateMapping(mapping: SaleImportMapping, headers: string[]) {
	const headerSet = new Set(headers);

	for (const config of REQUIRED_FIELD_CONFIG) {
		const value = mapping.fields[config.key];
		if (config.required && !value) {
			return `Mapeie o campo obrigatório: ${config.label}.`;
		}
		if (value && !headerSet.has(value)) {
			return `A coluna mapeada para ${config.label} não existe no arquivo.`;
		}
	}

	if (!mapping.fixedValues.companyId) {
		return "Selecione a empresa fixa do lote.";
	}

	if (!mapping.fixedValues.parentProductId) {
		return "Selecione o produto da importação.";
	}

	if (mapping.dynamicByProduct.length > 1) {
		return "O mapeamento de campos personalizados permite somente 1 produto.";
	}

	for (const dynamicMapping of mapping.dynamicByProduct) {
		if (dynamicMapping.productId !== mapping.fixedValues.parentProductId) {
			return "Campos personalizados devem usar o mesmo produto selecionado para importação.";
		}

		for (const fieldMapping of dynamicMapping.fields) {
			if (!fieldMapping.columnKey) {
				continue;
			}
			if (!headerSet.has(fieldMapping.columnKey)) {
				return "Existe campo personalizado mapeado para uma coluna inexistente.";
			}
		}
	}

	return null;
}

function toOptionalSelectValue(value: string | undefined) {
	return value && value.length > 0 ? value : NONE_VALUE;
}

function fromOptionalSelectValue(value: string) {
	return value === NONE_VALUE ? undefined : value;
}

interface SingleProductDynamicMappingCardProps {
	productId: string;
	productLabel: string | null;
	headers: string[];
	fieldMappings: SaleImportDynamicProductMapping["fields"];
	onChangeField: (fieldId: string, columnKey: string | undefined) => void;
}

function SingleProductDynamicMappingCard({
	productId,
	productLabel,
	headers,
	fieldMappings,
	onChangeField,
}: SingleProductDynamicMappingCardProps) {
	const { organization } = useApp();
	const fieldMappingsByFieldId = useMemo(() => {
		return new Map(
			fieldMappings.map((field) => [field.fieldId, field.columnKey]),
		);
	}, [fieldMappings]);

	const productFieldsQuery = useGetOrganizationsSlugProductsIdSaleFields(
		{
			slug: organization?.slug ?? "",
			id: productId,
			params: {
				includeInherited: true,
			},
		},
		{
			query: {
				enabled: Boolean(organization?.slug && productId),
			},
		},
	);

	const fields = productFieldsQuery.data?.fields ?? [];

	return (
		<Card className="space-y-4 p-4">
			<div className="space-y-1">
				<Label>Produto selecionado</Label>
				<p className="font-medium text-sm">
					{productLabel ?? "Produto não encontrado"}
				</p>
			</div>

			{productFieldsQuery.isLoading || productFieldsQuery.isFetching ? (
				<p className="text-sm text-muted-foreground">
					Carregando campos do produto...
				</p>
			) : fields.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					Este produto não possui campos personalizados.
				</p>
			) : (
				<div className="space-y-3">
					{fields.map((field) => (
						<div
							key={field.id}
							className="grid gap-2 md:grid-cols-[2fr_3fr] md:items-end"
						>
							<div>
								<p className="font-medium text-sm">{field.label}</p>
								<p className="text-xs text-muted-foreground">
									Tipo: {field.type}
									{field.required ? " | Obrigatório" : " | Opcional"}
								</p>
							</div>
							<Select
								value={toOptionalSelectValue(
									fieldMappingsByFieldId.get(field.id),
								)}
								onValueChange={(value) => {
									onChangeField(
										field.id,
										fromOptionalSelectValue(value),
									);
								}}
							>
								<SelectTrigger>
									<SelectValue placeholder="Selecionar coluna do Excel" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE_VALUE}>
										Não importar este campo
									</SelectItem>
									{headers.map((header) => (
										<SelectItem key={header} value={header}>
											{header}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					))}
				</div>
			)}
		</Card>
	);
}

export function ImportSalesWizard() {
	const [step, setStep] = useState<WizardStep>("UPLOAD");
	const [parsedFile, setParsedFile] = useState<ParsedImportFile | null>(null);
	const [isParsing, setIsParsing] = useState(false);
	const [mapping, setMapping] = useState<SaleImportMapping | null>(null);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
	const [templateName, setTemplateName] = useState("");
	const [importResult, setImportResult] = useState<SaleImportResult | null>(
		null,
	);
	const [importSummary, setImportSummary] =
		useState<ImportProgressSummary | null>(null);
	const [failedRowsDrafts, setFailedRowsDrafts] = useState<
		FailedImportRowDraft[]
	>([]);
	const [finalizationRowsDrafts, setFinalizationRowsDrafts] = useState<
		FinalizationRowDraft[]
	>([]);
	const [finalizationPage, setFinalizationPage] = useState(1);
	const [manualError, setManualError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const autoAppliedTemplateRef = useRef<string | null>(null);

	const { organization } = useApp();
	const {
		companies,
		products,
		sellers,
		partners,
		isLoading: isLoadingOptions,
	} = useSaleFormOptions();

	const templatesQuery = useSaleImportTemplates({
		headerSignature: parsedFile?.headerSignature,
		enabled: Boolean(parsedFile?.headerSignature),
	});

	const createTemplateMutation = useCreateSaleImportTemplate();
	const updateTemplateMutation = useUpdateSaleImportTemplate();
	const deleteTemplateMutation = useDeleteSaleImportTemplate();
	const executeImportMutation = useExecuteSaleImport();

	const productOptions = useMemo(
		() =>
			products.map((product) => ({
				id: product.id,
				label: product.label,
				name: product.name,
			})),
		[products],
	);

	const selectedCompany = useMemo(
		() =>
			companies.find(
				(company) => company.id === mapping?.fixedValues.companyId,
			),
		[companies, mapping?.fixedValues.companyId],
	);
	const companyUnits = selectedCompany?.units ?? [];
	const selectedImportProduct = useMemo(
		() =>
			productOptions.find(
				(product) => product.id === mapping?.fixedValues.parentProductId,
			) ?? null,
		[productOptions, mapping?.fixedValues.parentProductId],
	);
	const selectedDynamicMapping = useMemo(() => {
		if (!mapping?.fixedValues.parentProductId) {
			return null;
		}

		return (
			mapping.dynamicByProduct.find(
				(dynamicMapping) =>
					dynamicMapping.productId === mapping.fixedValues.parentProductId,
			) ?? null
		);
	}, [mapping]);

	const responsibleOptions = useMemo(() => {
		if (!mapping) {
			return [];
		}

		if (mapping.fixedValues.responsible?.type === "PARTNER") {
			return partners.map((partner) => ({
				id: partner.id,
				label: partner.name,
			}));
		}

		if (mapping.fixedValues.responsible?.type === "SELLER") {
			return sellers.map((seller) => ({
				id: seller.id,
				label: seller.name,
			}));
		}

		return [];
	}, [mapping, partners, sellers]);
	const selectedResponsibleLabel = useMemo(() => {
		const responsible = mapping?.fixedValues.responsible;
		if (!responsible) {
			return "Sem responsável fixo";
		}

		const option = responsibleOptions.find(
			(currentOption) => currentOption.id === responsible.id,
		);
		return option?.label ?? responsible.id;
	}, [mapping?.fixedValues.responsible, responsibleOptions]);

	const selectedTemplate = useMemo(() => {
		return (
			templatesQuery.data?.templates.find(
				(template) => template.id === selectedTemplateId,
			) ?? null
		);
	}, [selectedTemplateId, templatesQuery.data?.templates]);
	const finalizationColumns = useMemo(
		() => (mapping ? buildFinalizationPreviewColumns(mapping) : []),
		[mapping],
	);

	const retrySelectedRowsCount = useMemo(
		() => failedRowsDrafts.filter((row) => row.shouldRetry).length,
		[failedRowsDrafts],
	);
	const finalizationTotalRows = finalizationRowsDrafts.length;
	const finalizationRowsWithWarningsCount = useMemo(
		() =>
			finalizationRowsDrafts.filter((row) => row.validationErrors.length > 0)
				.length,
		[finalizationRowsDrafts],
	);
	const finalizationValidRowsCount =
		finalizationTotalRows - finalizationRowsWithWarningsCount;
	const finalizationSelectedRowsCount = useMemo(
		() =>
			finalizationRowsDrafts.filter((row) => row.selectedForImport).length,
		[finalizationRowsDrafts],
	);
	const finalizationTotalPages = Math.max(
		1,
		Math.ceil(finalizationTotalRows / FINALIZATION_PAGE_SIZE),
	);
	const currentFinalizationPage = Math.min(
		Math.max(finalizationPage, 1),
		finalizationTotalPages,
	);
	const finalizationPageStartIndex =
		(currentFinalizationPage - 1) * FINALIZATION_PAGE_SIZE;
	const finalizationPageRows = finalizationRowsDrafts.slice(
		finalizationPageStartIndex,
		finalizationPageStartIndex + FINALIZATION_PAGE_SIZE,
	);
	const ignoredRowsCount = failedRowsDrafts.length - retrySelectedRowsCount;
	const totalRowsCount =
		importSummary?.totalRows ??
		importResult?.totalRows ??
		finalizationSelectedRowsCount ??
		0;
	const importedRowsCount =
		importSummary?.importedRows ?? importResult?.importedRows ?? 0;
	const failedRowsCount = failedRowsDrafts.length;

	useEffect(() => {
		if (finalizationPage > finalizationTotalPages) {
			setFinalizationPage(finalizationTotalPages);
		}
	}, [finalizationPage, finalizationTotalPages]);

	useEffect(() => {
		if (!parsedFile || !mapping || isLoadingOptions) {
			return;
		}

		const defaultFixedValues = resolveInitialFixedValues({
			companies,
			products: productOptions,
		});
		const shouldSetCompany =
			!mapping.fixedValues.companyId && Boolean(defaultFixedValues.companyId);
		const shouldSetProduct =
			!mapping.fixedValues.parentProductId &&
			Boolean(defaultFixedValues.parentProductId);

		if (!shouldSetCompany && !shouldSetProduct) {
			return;
		}

		setMapping((currentValue) => {
			if (!currentValue) {
				return currentValue;
			}

			const nextFixedValues = {
				...currentValue.fixedValues,
				...(shouldSetCompany
					? {
							companyId: defaultFixedValues.companyId,
							unitId: defaultFixedValues.unitId,
						}
					: {}),
				...(shouldSetProduct
					? {
							parentProductId: defaultFixedValues.parentProductId,
						}
					: {}),
			};
			const normalizedDynamicByProduct = nextFixedValues.parentProductId
				? resolveSingleDynamicByProduct({
						selectedProductId: nextFixedValues.parentProductId,
						dynamicByProduct: currentValue.dynamicByProduct,
					})
				: [];

			return {
				...currentValue,
				fixedValues: nextFixedValues,
				dynamicByProduct: normalizedDynamicByProduct,
			};
		});
	}, [parsedFile, mapping, isLoadingOptions, companies, productOptions]);

	useEffect(() => {
		if (!templatesQuery.data?.templates || !mapping || !parsedFile) {
			return;
		}

		if (autoAppliedTemplateRef.current === parsedFile.headerSignature) {
			return;
		}

		const suggestedTemplate = templatesQuery.data.templates.find(
			(template) => template.isSuggested,
		);

		if (!suggestedTemplate) {
			autoAppliedTemplateRef.current = parsedFile.headerSignature;
			return;
		}

		setMapping((currentValue) => {
			if (!currentValue) {
				return currentValue;
			}
			const normalizedTemplate = normalizeTemplateForSingleProduct(
				suggestedTemplate,
			);
			return {
				...currentValue,
				fields: normalizedTemplate.fields,
				fixedValues: normalizedTemplate.fixedValues,
				dynamicByProduct: normalizedTemplate.dynamicByProduct,
			};
		});
		setSelectedTemplateId(suggestedTemplate.id);
		autoAppliedTemplateRef.current = parsedFile.headerSignature;
		toast.success(`Modelo sugerido aplicado: ${suggestedTemplate.name}`);
	}, [mapping, parsedFile, templatesQuery.data?.templates]);

	useEffect(() => {
		if (!mapping || productOptions.length === 0) {
			return;
		}

		const productColumn = mapping.fields.productColumn;
		const parentProductId = mapping.fixedValues.parentProductId;
		const scopedProducts = getParentScopedProductOptions({
			parentProductId,
			productOptions,
		});
		setFailedRowsDrafts((currentValue) => {
			let hasChanges = false;

			const nextRows = currentValue.map((row) => {
				if (!productColumn || row.failure.field !== productColumn) {
					return row;
				}

				const currentValueRaw = stringifyImportCellValue(
					row.rowData[productColumn],
				).trim();
				if (!currentValueRaw) {
					return row;
				}

				const isExistingProductId = productOptions.some(
					(product) => product.id === currentValueRaw,
				);
				const isExistingProductInScope = scopedProducts.some(
					(product) => product.id === currentValueRaw,
				);
				if (isExistingProductId && isExistingProductInScope) {
					return row;
				}

				const preferredRawValue =
					row.excelFieldValue?.trim() || currentValueRaw;
				const suggestedProductId = findBestProductSuggestionWithinScope({
					rawValue: preferredRawValue,
					parentProductId,
					productOptions,
				});
				if (!suggestedProductId) {
					return row;
				}

				hasChanges = true;
				return {
					...row,
					rowData: {
						...row.rowData,
						[productColumn]: suggestedProductId,
					},
				};
			});

			return hasChanges ? nextRows : currentValue;
		});
	}, [mapping, productOptions]);

	function applyTemplate(template: SaleImportTemplate) {
		setMapping((currentValue) => {
			if (!currentValue) {
				return currentValue;
			}
			const normalizedTemplate = normalizeTemplateForSingleProduct(template);

			return {
				...currentValue,
				fields: normalizedTemplate.fields,
				fixedValues: normalizedTemplate.fixedValues,
				dynamicByProduct: normalizedTemplate.dynamicByProduct,
			};
		});
		setSelectedTemplateId(template.id);
		toast.success(`Modelo aplicado: ${template.name}`);
	}

	async function handleAnalyzeFile(file: File) {
		setIsParsing(true);
		setManualError(null);
		try {
			const parsed = await parseSpreadsheetFile(file);
			setParsedFile(parsed);
				setImportResult(null);
				setImportSummary(null);
				setFailedRowsDrafts([]);
				setFinalizationRowsDrafts([]);
				setFinalizationPage(1);
				setTemplateName("");
				setSelectedTemplateId("");
			autoAppliedTemplateRef.current = null;
			setMapping(
				createInitialMapping({
					headers: parsed.headers,
					companies,
					products: productOptions,
				}),
			);
			setStep("MAPPING");
		} catch (error) {
			setManualError(
				error instanceof Error
					? error.message
					: "Não foi possível analisar o arquivo informado.",
			);
		} finally {
			setIsParsing(false);
		}
	}

	async function handleFileInputChange(
		event: React.ChangeEvent<HTMLInputElement>,
	) {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}

		await handleAnalyzeFile(file);
	}

	function updateFailedRowRetrySelection(
		rowNumber: number,
		shouldRetry: boolean,
	) {
		setFailedRowsDrafts((currentValue) =>
			currentValue.map((row) =>
				row.originalRowNumber === rowNumber ? { ...row, shouldRetry } : row,
			),
		);
	}

	function setAllFailedRowRetrySelection(shouldRetry: boolean) {
		setFailedRowsDrafts((currentValue) =>
			currentValue.map((row) => ({
				...row,
				shouldRetry,
			})),
		);
	}

	function updateFailedRowCellValue(
		rowNumber: number,
		columnKey: string,
		value: string,
		editorType: FailedRowEditorType,
	) {
		setFailedRowsDrafts((currentValue) =>
			currentValue.map((row) =>
				row.originalRowNumber === rowNumber
					? {
							...row,
							shouldRetry: isCorrectionValueValid(editorType, value),
							rowData: {
								...row.rowData,
								[columnKey]: value,
							},
						}
					: row,
			),
		);
	}

	function updateFailedRowProductValue(
		rowNumber: number,
		columnKey: string,
		selectedValue: string,
	) {
		const nextValue = selectedValue === NONE_VALUE ? "" : selectedValue;
		setFailedRowsDrafts((currentValue) =>
			currentValue.map((row) =>
				row.originalRowNumber === rowNumber
					? {
							...row,
							shouldRetry: isCorrectionValueValid("PRODUCT", nextValue),
							rowData: {
								...row.rowData,
								[columnKey]: nextValue,
							},
						}
					: row,
			),
			);
	}

	function updateFinalizationRowSelection(
		rowNumber: number,
		selectedForImport: boolean,
	) {
		setFinalizationRowsDrafts((currentValue) =>
			currentValue.map((row) =>
				row.rowNumber === rowNumber ? { ...row, selectedForImport } : row,
			),
		);
	}

	function updateFinalizationRowCellValue(
		rowNumber: number,
		columnKey: string,
		value: string,
	) {
		setFinalizationRowsDrafts((currentValue) =>
			currentValue.map((row) => {
				if (row.rowNumber !== rowNumber || !mapping) {
					return row;
				}

				const nextRowData = {
					...row.rowData,
					[columnKey]: value,
				};
				const nextValidationErrors = validateFinalizationRowDraft({
					rowData: nextRowData,
					mapping,
				});

				let nextSelectedForImport = row.selectedForImport;
				if (row.validationErrors.length === 0 && nextValidationErrors.length > 0) {
					nextSelectedForImport = false;
				}
				if (row.validationErrors.length > 0 && nextValidationErrors.length === 0) {
					nextSelectedForImport = true;
				}

				return {
					...row,
					rowData: nextRowData,
					validationErrors: nextValidationErrors,
					selectedForImport: nextSelectedForImport,
				};
			}),
		);
	}

	function setAllFinalizationRowsSelection(selectedForImport: boolean) {
		setFinalizationRowsDrafts((currentValue) =>
			currentValue.map((row) => ({
				...row,
				selectedForImport,
			})),
		);
	}

	function updateFieldMapping(
		fieldKey: keyof SaleImportFieldMapping,
		columnValue: string | undefined,
	) {
		setMapping((currentValue) => {
			if (!currentValue) {
				return currentValue;
			}

			return {
				...currentValue,
				fields: {
					...currentValue.fields,
					[fieldKey]: columnValue,
				},
			};
		});
	}

	function updateFixedValues(nextFixedValues: Partial<SaleImportFixedValues>) {
		setMapping((currentValue) => {
			if (!currentValue) {
				return currentValue;
			}

			return {
				...currentValue,
				fixedValues: {
					...currentValue.fixedValues,
					...nextFixedValues,
				},
			};
		});
	}

	function updateSelectedImportProduct(productId: string) {
		setMapping((currentValue) => {
			if (!currentValue) {
				return currentValue;
			}

			return {
				...currentValue,
				fixedValues: {
					...currentValue.fixedValues,
					parentProductId: productId,
				},
				dynamicByProduct: resolveSingleDynamicByProduct({
					selectedProductId: productId,
					dynamicByProduct: currentValue.dynamicByProduct,
				}),
			};
		});
	}

	function updateDynamicField(fieldId: string, columnKey: string | undefined) {
		setMapping((currentValue) => {
			if (!currentValue || !currentValue.fixedValues.parentProductId) {
				return currentValue;
			}

			const selectedProductId = currentValue.fixedValues.parentProductId;
			const currentProductMapping = resolveSingleDynamicByProduct({
				selectedProductId,
				dynamicByProduct: currentValue.dynamicByProduct,
			})[0];
			if (!currentProductMapping) {
				return currentValue;
			}

			const filteredFields = currentProductMapping.fields.filter(
				(field) => field.fieldId !== fieldId,
			);
			if (columnKey) {
				filteredFields.push({
					fieldId,
					columnKey,
				});
			}

			return {
				...currentValue,
				dynamicByProduct: [
					{
						productId: selectedProductId,
						fields: filteredFields,
					},
				],
			};
		});
	}

	async function handleSaveTemplate() {
		if (!parsedFile || !mapping || !organization?.slug) {
			return;
		}

		const validationError = validateMapping(mapping, parsedFile.headers);
		if (validationError) {
			toast.error(validationError);
			return;
		}

		const normalizedTemplateName = templateName.trim();
		if (!normalizedTemplateName) {
			toast.error("Informe um nome para salvar o modelo.");
			return;
		}

		const normalizedMapping = normalizeMappingForRequest(mapping);

		try {
			const createdTemplate = await createTemplateMutation.mutateAsync({
				name: normalizedTemplateName,
				headerSignature: parsedFile.headerSignature,
				mapping: {
					fields: normalizedMapping.fields,
					dynamicByProduct: normalizedMapping.dynamicByProduct,
				},
				fixedValues: normalizedMapping.fixedValues,
			});
			setSelectedTemplateId(createdTemplate.templateId);
			setTemplateName("");
		} catch {
			// handled in mutation
		}
	}

	async function handleUpdateSelectedTemplate() {
		if (!parsedFile || !mapping || !selectedTemplate) {
			return;
		}

		const validationError = validateMapping(mapping, parsedFile.headers);
		if (validationError) {
			toast.error(validationError);
			return;
		}

		const normalizedMapping = normalizeMappingForRequest(mapping);

		try {
			await updateTemplateMutation.mutateAsync({
				templateId: selectedTemplate.id,
				data: {
					name: selectedTemplate.name,
					headerSignature: parsedFile.headerSignature,
					mapping: {
						fields: normalizedMapping.fields,
						dynamicByProduct: normalizedMapping.dynamicByProduct,
					},
					fixedValues: normalizedMapping.fixedValues,
				},
			});
		} catch {
			// handled in mutation
		}
	}

	async function handleDeleteSelectedTemplate() {
		if (!selectedTemplate) {
			return;
		}

		try {
			await deleteTemplateMutation.mutateAsync(selectedTemplate.id);
			setSelectedTemplateId("");
		} catch {
			// handled in mutation
		}
	}

	function handleGoToFinalization() {
		if (!parsedFile || !mapping) {
			return;
		}

		const validationError = validateMapping(mapping, parsedFile.headers);
		if (validationError) {
			toast.error(validationError);
			return;
		}

		if (parsedFile.rows.length > MAX_IMPORT_ROWS) {
			toast.error(
				`O limite máximo é de ${MAX_IMPORT_ROWS} linhas por importação.`,
			);
			return;
		}

		const normalizedMapping = normalizeMappingForRequest(mapping);
		const columns = buildFinalizationPreviewColumns(normalizedMapping);
		const rowDrafts = buildFinalizationRowDrafts({
			rows: parsedFile.rows,
			mapping: normalizedMapping,
			columns,
			productOptions,
		});

		setFinalizationRowsDrafts(rowDrafts);
		setFinalizationPage(1);
		setManualError(null);
		setStep("FINALIZATION");
	}

	async function handleExecuteImport() {
		if (!parsedFile || !mapping) {
			return;
		}

		const validationError = validateMapping(mapping, parsedFile.headers);
		if (validationError) {
			toast.error(validationError);
			return;
		}

		const selectedRows = finalizationRowsDrafts.filter(
			(row) => row.selectedForImport,
		);
		if (selectedRows.length === 0) {
			toast.error("Selecione ao menos uma linha para importar.");
			return;
		}

		const normalizedMapping = normalizeMappingForRequest(mapping);
		const sourceRows: FailedImportSourceRow[] = selectedRows.map((row) => ({
			originalRowNumber: row.rowNumber,
			rowData: { ...row.rowData },
		}));

		try {
			const result = await executeImportMutation.mutateAsync({
				fileType: parsedFile.fileType,
				headerSignature: parsedFile.headerSignature,
				templateId: selectedTemplateId || undefined,
				rows: sourceRows.map((row) => row.rowData),
				mapping: normalizedMapping,
			});

			setImportResult(result);
			setImportSummary({
				totalRows: sourceRows.length,
				importedRows: result.importedRows,
			});
			setFailedRowsDrafts(
				buildFailedRowDrafts({
					failures: result.failures,
					sourceRows,
				}),
			);
			setStep("RESULT");
		} catch {
			// handled in mutation
		}
	}

	async function handleRetryFailedRows() {
		if (!parsedFile || !mapping) {
			return;
		}

		const validationError = validateMapping(mapping, parsedFile.headers);
		if (validationError) {
			toast.error(validationError);
			return;
		}

		const retrySourceRows: FailedImportSourceRow[] = failedRowsDrafts
			.filter((row) => row.shouldRetry)
			.map((row) => ({
				originalRowNumber: row.originalRowNumber,
				rowData: { ...row.rowData },
			}));

		if (retrySourceRows.length === 0) {
			toast.error("Selecione ao menos uma linha com falha para reprocessar.");
			return;
		}

		const normalizedMapping = normalizeMappingForRequest(mapping);

		try {
			const result = await executeImportMutation.mutateAsync({
				fileType: parsedFile.fileType,
				headerSignature: parsedFile.headerSignature,
				templateId: selectedTemplateId || undefined,
				rows: retrySourceRows.map((row) => row.rowData),
				mapping: normalizedMapping,
			});

			const retryFailures = buildFailedRowDrafts({
				failures: result.failures,
				sourceRows: retrySourceRows,
			});
			const retryFailuresByRowNumber = new Map(
				retryFailures.map((row) => [row.originalRowNumber, row]),
			);

			const nextFailedRows = failedRowsDrafts.flatMap((row) => {
				if (!row.shouldRetry) {
					return [row];
				}

				const retriedFailure = retryFailuresByRowNumber.get(
					row.originalRowNumber,
				);
				return retriedFailure ? [retriedFailure] : [];
			});

				setImportResult(result);
				setImportSummary((currentValue) => {
					if (!currentValue) {
						return {
							totalRows: retrySourceRows.length,
							importedRows: result.importedRows,
						};
					}

					return {
						...currentValue,
						importedRows: currentValue.importedRows + result.importedRows,
					};
				});
			setFailedRowsDrafts(nextFailedRows);

			if (nextFailedRows.length === 0) {
				toast.success(
					"Todas as linhas com falha foram importadas com sucesso.",
				);
			}
		} catch {
			// handled in mutation
		}
	}

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Importar vendas por planilha"
				description={`Fluxo seguro com análise, mapeamento e importação parcial (máximo ${MAX_IMPORT_ROWS} linhas).`}
				actions={
					<Button asChild variant="outline">
						<Link to="/sales">Voltar para vendas</Link>
					</Button>
				}
			/>

			<Card className="flex flex-col gap-4 p-4">
				<div className="flex flex-wrap items-center gap-2 text-sm">
					<span
						className={`rounded-full px-3 py-1 font-medium ${
							step === "UPLOAD"
								? "bg-primary text-primary-foreground"
								: "bg-muted text-muted-foreground"
						}`}
					>
						1. Upload / Análise
					</span>
					<span
						className={`rounded-full px-3 py-1 font-medium ${
							step === "MAPPING"
								? "bg-primary text-primary-foreground"
								: "bg-muted text-muted-foreground"
						}`}
					>
						2. Mapeamento
					</span>
					<span
						className={`rounded-full px-3 py-1 font-medium ${
							step === "FINALIZATION"
								? "bg-primary text-primary-foreground"
								: "bg-muted text-muted-foreground"
						}`}
					>
						3. Finalização
					</span>
					<span
						className={`rounded-full px-3 py-1 font-medium ${
							step === "RESULT"
								? "bg-primary text-primary-foreground"
								: "bg-muted text-muted-foreground"
						}`}
					>
						4. Resultado
					</span>
				</div>

				{step === "UPLOAD" ? (
					<div className="space-y-4">
						<p className="text-sm text-muted-foreground">
							Formatos aceitos: <strong>.xlsx</strong>, <strong>.xls</strong> e
							<strong> .csv</strong>. Arquivos suspeitos ou fora do limite são
							bloqueados automaticamente.
						</p>

						<div className="space-y-2">
							<Label htmlFor="sales-import-file">Arquivo da planilha</Label>
							<Input
								id="sales-import-file"
								ref={fileInputRef}
								type="file"
								accept=".xlsx,.xls,.csv"
								onChange={handleFileInputChange}
								disabled={isParsing}
							/>
						</div>

						{isParsing ? (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="size-4 animate-spin" />
								Analisando planilha...
							</div>
						) : null}

						{manualError ? (
							<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
								<AlertCircle className="mt-0.5 size-4" />
								<span>{manualError}</span>
							</div>
						) : null}

						{parsedFile ? (
							<div className="rounded-md border bg-muted/30 p-3 text-sm">
								<p className="font-medium">Arquivo analisado com sucesso</p>
								<p className="text-muted-foreground">
									{parsedFile.name} | {parsedFile.rows.length} linhas |{" "}
									{parsedFile.headers.length} colunas
								</p>
								<div className="mt-3 flex gap-2">
									<Button type="button" onClick={() => setStep("MAPPING")}>
										<FileSpreadsheet className="size-4" />
										Continuar para mapeamento
									</Button>
									<Button
										type="button"
										variant="outline"
										onClick={() => fileInputRef.current?.click()}
									>
										<Upload className="size-4" />
										Trocar arquivo
									</Button>
								</div>
							</div>
						) : null}
					</div>
				) : null}

				{step === "MAPPING" && parsedFile && mapping ? (
					<div className="space-y-6">
						<Card className="space-y-4 p-4">
							<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
								<div>
									<h3 className="font-semibold">Arquivo analisado</h3>
									<p className="text-sm text-muted-foreground">
										{parsedFile.name} | {parsedFile.rows.length} linhas |{" "}
										{parsedFile.headers.length} colunas
									</p>
								</div>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setStep("UPLOAD");
									}}
								>
									Trocar arquivo
								</Button>
							</div>
						</Card>

						<Card className="space-y-4 p-4">
							<h3 className="font-semibold">Modelos de importação</h3>
							<p className="text-sm text-muted-foreground">
								O sistema sugere automaticamente modelos compatíveis com o
								cabeçalho deste arquivo.
							</p>

							<div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
								<Select
									value={selectedTemplateId || NONE_VALUE}
									onValueChange={(value) => {
										if (value === NONE_VALUE) {
											setSelectedTemplateId("");
											return;
										}

										setSelectedTemplateId(value);
										const template = templatesQuery.data?.templates.find(
											(currentTemplate) => currentTemplate.id === value,
										);
										if (template) {
											applyTemplate(template);
										}
									}}
								>
									<SelectTrigger>
										<SelectValue placeholder="Selecionar modelo" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NONE_VALUE}>Sem modelo</SelectItem>
										{(templatesQuery.data?.templates ?? []).map((template) => (
											<SelectItem key={template.id} value={template.id}>
												{template.name}
												{template.isSuggested ? " (Sugerido)" : ""}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								<Button
									type="button"
									variant="outline"
									disabled={
										!selectedTemplateId || deleteTemplateMutation.isPending
									}
									onClick={handleDeleteSelectedTemplate}
								>
									<Trash2 className="size-4" />
									Excluir modelo
								</Button>

								<Button
									type="button"
									variant="outline"
									disabled={
										!selectedTemplate || updateTemplateMutation.isPending
									}
									onClick={handleUpdateSelectedTemplate}
								>
									<Save className="size-4" />
									Atualizar modelo
								</Button>
							</div>

							<div className="grid gap-3 md:grid-cols-[2fr_1fr]">
								<Input
									value={templateName}
									onChange={(event) => setTemplateName(event.target.value)}
									placeholder="Nome para novo modelo"
								/>
								<Button
									type="button"
									onClick={handleSaveTemplate}
									disabled={createTemplateMutation.isPending}
								>
									<Save className="size-4" />
									Salvar novo modelo
								</Button>
							</div>
						</Card>

						<Card className="space-y-4 p-4">
							<h3 className="font-semibold">Mapeamento de campos padrão</h3>
							<div className="grid gap-3 md:grid-cols-2">
								{REQUIRED_FIELD_CONFIG.map((fieldConfig) => (
									<div key={fieldConfig.key} className="space-y-1">
										<Label>
											{fieldConfig.label}
											{fieldConfig.required ? " *" : ""}
										</Label>
										<Select
											value={toOptionalSelectValue(
												mapping.fields[fieldConfig.key],
											)}
											onValueChange={(value) =>
												updateFieldMapping(
													fieldConfig.key,
													fromOptionalSelectValue(value),
												)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="Selecionar coluna" />
											</SelectTrigger>
											<SelectContent>
												{!fieldConfig.required ? (
													<SelectItem value={NONE_VALUE}>Não mapear</SelectItem>
												) : null}
												{parsedFile.headers.map((header) => (
													<SelectItem key={header} value={header}>
														{header}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<p className="text-muted-foreground text-xs">
											{fieldConfig.help}
										</p>
									</div>
								))}
							</div>
						</Card>

						<Card className="space-y-4 p-4">
							<h3 className="font-semibold">Valores fixos do lote</h3>

							<div className="grid gap-3 md:grid-cols-2">
								<div className="space-y-1">
									<Label>Empresa *</Label>
									<Select
										value={mapping.fixedValues.companyId || NONE_VALUE}
										onValueChange={(value) => {
											const companyId = value === NONE_VALUE ? "" : value;
											const selectedCompanyOption = companies.find(
												(company) => company.id === companyId,
											);
											updateFixedValues({
												companyId,
												unitId: selectedCompanyOption?.units?.[0]?.id,
											});
										}}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione a empresa" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE_VALUE}>Selecionar...</SelectItem>
											{companies.map((company) => (
												<SelectItem key={company.id} value={company.id}>
													{company.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<Label>Unidade</Label>
									<Select
										value={toOptionalSelectValue(mapping.fixedValues.unitId)}
										onValueChange={(value) =>
											updateFixedValues({
												unitId: fromOptionalSelectValue(value),
											})
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Sem unidade" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE_VALUE}>Sem unidade</SelectItem>
											{companyUnits.map((unit) => (
												<SelectItem key={unit.id} value={unit.id}>
													{unit.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<Label>Produto da Importação *</Label>
									<Select
										value={mapping.fixedValues.parentProductId || NONE_VALUE}
										onValueChange={(value) => {
											if (value === NONE_VALUE) {
												return;
											}
											updateSelectedImportProduct(value);
										}}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione o produto da importação" />
										</SelectTrigger>
										<SelectContent>
											{productOptions.length === 0 ? (
												<SelectItem value={NONE_VALUE} disabled>
													Nenhum produto disponível
												</SelectItem>
											) : null}
											{productOptions.map((product) => (
												<SelectItem key={product.id} value={product.id}>
													{product.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<p className="text-muted-foreground text-xs">
										Este produto é aplicado em todas as linhas e usado como
										fallback quando não houver match confiável de filho.
									</p>
								</div>

								<div className="space-y-1">
									<Label>Tipo do responsável</Label>
									<Select
										value={mapping.fixedValues.responsible?.type ?? NONE_VALUE}
										onValueChange={(value) => {
											if (value === NONE_VALUE) {
												updateFixedValues({
													responsible: undefined,
												});
												return;
											}

											const responsibleType = value as "SELLER" | "PARTNER";
											const defaultResponsibleId =
												responsibleType === "SELLER"
													? (sellers[0]?.id ?? "")
													: (partners[0]?.id ?? "");

											if (!defaultResponsibleId) {
												updateFixedValues({
													responsible: undefined,
												});
												toast.error(
													"Nenhum responsável ativo disponível para o tipo selecionado.",
												);
												return;
											}

											updateFixedValues({
												responsible: {
													type: responsibleType,
													id: defaultResponsibleId,
												},
											});
										}}
									>
										<SelectTrigger>
											<SelectValue placeholder="Sem responsável fixo (definir depois)" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE_VALUE}>
												Sem responsável fixo (definir depois)
											</SelectItem>
											<SelectItem value="SELLER">Vendedor</SelectItem>
											<SelectItem value="PARTNER">Parceiro</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<Label>Responsável</Label>
									<Select
										value={mapping.fixedValues.responsible?.id || NONE_VALUE}
										disabled={!mapping.fixedValues.responsible}
										onValueChange={(value) => {
											const currentResponsible =
												mapping.fixedValues.responsible;
											if (!currentResponsible) {
												return;
											}

											if (value === NONE_VALUE) {
												updateFixedValues({
													responsible: undefined,
												});
												return;
											}

											updateFixedValues({
												responsible: {
													...currentResponsible,
													id: value,
												},
											});
										}}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione o responsável" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE_VALUE}>Selecionar...</SelectItem>
											{responsibleOptions.map((responsible) => (
												<SelectItem key={responsible.id} value={responsible.id}>
													{responsible.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</Card>

						<Card className="space-y-4 p-4">
							<div>
								<h3 className="font-semibold">
									Campos personalizados do produto selecionado
								</h3>
								<p className="text-sm text-muted-foreground">
									Mapeie os campos que deseja importar para o produto da
									importação.
								</p>
							</div>

							{!selectedImportProduct ? (
								<p className="text-sm text-muted-foreground">
									Selecione o produto da importação para carregar os campos
									personalizados.
								</p>
							) : (
								<SingleProductDynamicMappingCard
									productId={selectedImportProduct.id}
									productLabel={selectedImportProduct.label}
									headers={parsedFile.headers}
									fieldMappings={selectedDynamicMapping?.fields ?? []}
									onChangeField={updateDynamicField}
								/>
							)}
						</Card>

						{manualError ? (
							<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
								<AlertCircle className="mt-0.5 size-4" />
								<span>{manualError}</span>
							</div>
						) : null}

						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => setStep("UPLOAD")}
							>
								Voltar
							</Button>
							<Button
								type="button"
								onClick={handleGoToFinalization}
							>
								<FileSpreadsheet className="size-4" />
								Ir para finalização
							</Button>
						</div>
					</div>
					) : null}

					{step === "FINALIZATION" && parsedFile && mapping ? (
						<div className="space-y-4">
							<Card className="space-y-3 p-4">
								<div className="space-y-1">
									<h3 className="font-semibold">Finalização da importação</h3>
									<p className="text-sm text-muted-foreground">
										Revise e ajuste os dados antes de enviar. Linhas com alerta
										podem ser ignoradas ou corrigidas manualmente.
									</p>
								</div>
								<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
									<div className="rounded-md border p-3">
										<p className="text-muted-foreground text-xs">Total</p>
										<p className="font-semibold text-lg">{finalizationTotalRows}</p>
									</div>
									<div className="rounded-md border border-emerald-300/40 bg-emerald-500/10 p-3">
										<p className="text-emerald-800 text-xs">Válidas localmente</p>
										<p className="font-semibold text-emerald-800 text-lg">
											{finalizationValidRowsCount}
										</p>
									</div>
									<div className="rounded-md border border-amber-300/40 bg-amber-500/10 p-3">
										<p className="text-amber-800 text-xs">Com alerta</p>
										<p className="font-semibold text-amber-800 text-lg">
											{finalizationRowsWithWarningsCount}
										</p>
									</div>
									<div className="rounded-md border border-primary/30 bg-primary/10 p-3">
										<p className="text-primary text-xs">Selecionadas</p>
										<p className="font-semibold text-lg text-primary">
											{finalizationSelectedRowsCount}
										</p>
									</div>
								</div>
								<div className="grid gap-2 text-sm lg:grid-cols-2">
									<p>
										<strong>Empresa:</strong>{" "}
										{selectedCompany?.name ?? "Não selecionada"}
									</p>
									<p>
										<strong>Produto base:</strong>{" "}
										{selectedImportProduct?.label ?? "Não selecionado"}
									</p>
									<p>
										<strong>Responsável fixo:</strong> {selectedResponsibleLabel}
									</p>
									<p>
										<strong>Linhas por página:</strong> {FINALIZATION_PAGE_SIZE}
									</p>
								</div>
							</Card>

							<Card className="space-y-4 p-4">
								<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
									<div>
										<h3 className="font-semibold">Dados a importar</h3>
										<p className="text-sm text-muted-foreground">
											A tabela exibe apenas os campos mapeados nesta importação.
										</p>
									</div>
									<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="w-full sm:w-auto"
											onClick={() => setAllFinalizationRowsSelection(true)}
											disabled={executeImportMutation.isPending}
										>
											Selecionar todas
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="w-full sm:w-auto"
											onClick={() => setAllFinalizationRowsSelection(false)}
											disabled={executeImportMutation.isPending}
										>
											Ignorar todas
										</Button>
									</div>
								</div>

								{finalizationTotalRows === 0 ? (
									<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
										Nenhuma linha disponível para revisão.
									</div>
								) : (
									<>
										<div className="space-y-3 lg:hidden">
											{finalizationPageRows.map((rowDraft) => {
												const hasAlerts = rowDraft.validationErrors.length > 0;

												return (
													<div
														key={`finalization-mobile-row-${rowDraft.rowNumber}`}
														className={`space-y-3 rounded-md border p-3 ${
															hasAlerts ? "border-amber-300/40 bg-amber-500/5" : ""
														}`}
													>
														<div className="flex items-start justify-between gap-3">
															<div>
																<p className="font-medium">Linha {rowDraft.rowNumber}</p>
																<p
																	className={`text-xs ${
																		hasAlerts
																			? "text-amber-800"
																			: "text-emerald-700"
																	}`}
																>
																	{hasAlerts ? "Com alerta" : "Pronta"}
																</p>
															</div>
															<div className="flex items-center gap-2">
																<Checkbox
																	checked={rowDraft.selectedForImport}
																	onCheckedChange={(checked) =>
																		updateFinalizationRowSelection(
																			rowDraft.rowNumber,
																			Boolean(checked),
																		)
																	}
																	disabled={executeImportMutation.isPending}
																	aria-label={`Selecionar linha ${rowDraft.rowNumber}`}
																/>
																<span className="text-muted-foreground text-xs">
																	{rowDraft.selectedForImport ? "Incluir" : "Ignorar"}
																</span>
															</div>
														</div>

														<div
															className={`rounded-md border px-2.5 py-2 text-xs ${
																hasAlerts
																	? "border-amber-300/40 bg-amber-500/10 text-amber-900"
																	: "border-emerald-300/40 bg-emerald-500/10 text-emerald-900"
															}`}
														>
															{hasAlerts
																? rowDraft.validationErrors.join(" | ")
																: "Sem alertas"}
														</div>

														<div className="space-y-2">
															{finalizationColumns.map((column) => (
																<div
																	key={`finalization-mobile-input-${rowDraft.rowNumber}-${column.key}`}
																	className="space-y-1"
																>
																	<Label className="text-xs">{column.label}</Label>
																	<Input
																		value={stringifyImportCellValue(
																			rowDraft.rowData[column.key],
																		)}
																		onChange={(event) =>
																			updateFinalizationRowCellValue(
																				rowDraft.rowNumber,
																				column.key,
																				event.target.value,
																			)
																		}
																		disabled={executeImportMutation.isPending}
																	/>
																</div>
															))}
														</div>
													</div>
												);
											})}
										</div>

										<div className="hidden lg:block">
											<Table className="table-fixed">
												<TableHeader>
													<TableRow>
														<TableHead className="w-[90px]">Selecionar</TableHead>
														<TableHead className="w-[80px]">Linha</TableHead>
														<TableHead className="w-[120px]">Status</TableHead>
														<TableHead className="w-[220px] whitespace-normal">
															Alertas
														</TableHead>
														{finalizationColumns.map((column) => (
															<TableHead
																key={`finalization-column-${column.key}`}
																className="whitespace-normal"
															>
																{column.label}
															</TableHead>
														))}
													</TableRow>
												</TableHeader>
												<TableBody>
													{finalizationPageRows.map((rowDraft) => {
														const hasAlerts = rowDraft.validationErrors.length > 0;

														return (
															<TableRow
																key={`finalization-row-${rowDraft.rowNumber}`}
																className={hasAlerts ? "bg-amber-500/5" : undefined}
															>
																<TableCell>
																	<Checkbox
																		checked={rowDraft.selectedForImport}
																		onCheckedChange={(checked) =>
																			updateFinalizationRowSelection(
																				rowDraft.rowNumber,
																				Boolean(checked),
																			)
																		}
																		disabled={executeImportMutation.isPending}
																		aria-label={`Selecionar linha ${rowDraft.rowNumber}`}
																	/>
																</TableCell>
																<TableCell>{rowDraft.rowNumber}</TableCell>
																<TableCell>
																	{hasAlerts ? "Com alerta" : "Pronta"}
																</TableCell>
																<TableCell className="max-w-[220px] whitespace-normal text-xs align-top">
																	{hasAlerts
																		? rowDraft.validationErrors.join(" | ")
																		: "Sem alertas"}
																</TableCell>
																{finalizationColumns.map((column) => (
																	<TableCell
																		key={`finalization-row-${rowDraft.rowNumber}-${column.key}`}
																		className="min-w-[140px] align-top"
																	>
																		<Input
																			className="h-8 text-xs"
																			value={stringifyImportCellValue(
																				rowDraft.rowData[column.key],
																			)}
																			onChange={(event) =>
																				updateFinalizationRowCellValue(
																					rowDraft.rowNumber,
																					column.key,
																					event.target.value,
																				)
																			}
																			disabled={executeImportMutation.isPending}
																		/>
																	</TableCell>
																))}
															</TableRow>
														);
													})}
												</TableBody>
											</Table>
										</div>

										<div className="flex flex-col gap-2 text-sm lg:flex-row lg:items-center lg:justify-between">
											<p className="text-muted-foreground">
												Mostrando {finalizationPageStartIndex + 1} até{" "}
												{Math.min(
													finalizationPageStartIndex + FINALIZATION_PAGE_SIZE,
													finalizationTotalRows,
												)}{" "}
												de {finalizationTotalRows} linha(s)
											</p>
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
												<Button
													type="button"
													size="sm"
													variant="outline"
													className="w-full sm:w-auto"
													onClick={() =>
														setFinalizationPage((currentValue) =>
															Math.max(1, currentValue - 1),
														)
													}
													disabled={currentFinalizationPage <= 1}
												>
													Anterior
												</Button>
												<span className="text-muted-foreground text-center text-xs">
													Página {currentFinalizationPage} de{" "}
													{finalizationTotalPages}
												</span>
												<Button
													type="button"
													size="sm"
													variant="outline"
													className="w-full sm:w-auto"
													onClick={() =>
														setFinalizationPage((currentValue) =>
															Math.min(finalizationTotalPages, currentValue + 1),
														)
													}
													disabled={
														currentFinalizationPage >= finalizationTotalPages
													}
												>
													Próxima
												</Button>
											</div>
										</div>
									</>
								)}
							</Card>

							<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
								<Button
									type="button"
									variant="outline"
									className="w-full sm:w-auto"
									onClick={() => setStep("MAPPING")}
									disabled={executeImportMutation.isPending}
								>
									Voltar para mapeamento
								</Button>
								<Button
									type="button"
									className="w-full sm:w-auto"
									onClick={handleExecuteImport}
									disabled={
										executeImportMutation.isPending ||
										finalizationSelectedRowsCount === 0
									}
								>
									{executeImportMutation.isPending ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Upload className="size-4" />
									)}
									{executeImportMutation.isPending
										? "Importando..."
										: `Importar linhas selecionadas (${finalizationSelectedRowsCount})`}
								</Button>
							</div>
						</div>
					) : null}

					{step === "RESULT" && importResult ? (
						<div className="space-y-4">
						<Card className="space-y-3 p-4">
							<h3 className="font-semibold">Resumo da importação</h3>
							<div className="grid gap-3 md:grid-cols-4">
								<div className="rounded-md border p-3">
									<p className="text-muted-foreground text-xs">
										Total de linhas
									</p>
									<p className="font-semibold text-lg">{totalRowsCount}</p>
								</div>
								<div className="rounded-md border border-emerald-300/40 bg-emerald-500/10 p-3">
									<p className="text-xs text-emerald-800">Importadas</p>
									<p className="font-semibold text-lg text-emerald-800">
										{importedRowsCount}
									</p>
								</div>
								<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
									<p className="text-xs text-destructive">Falhas</p>
									<p className="font-semibold text-destructive text-lg">
										{failedRowsCount}
									</p>
								</div>
								<div className="rounded-md border border-amber-300/40 bg-amber-500/10 p-3">
									<p className="text-amber-800 text-xs">Ignoradas</p>
									<p className="font-semibold text-amber-800 text-lg">
										{ignoredRowsCount}
									</p>
								</div>
							</div>

							{failedRowsCount === 0 ? (
								<div className="flex items-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-500/10 p-3 text-emerald-800 text-sm">
									<CheckCircle2 className="size-4" />
									Importação concluída sem falhas.
								</div>
							) : (
								<p className="text-muted-foreground text-sm">
									{retrySelectedRowsCount} linha(s) selecionada(s) para nova
									tentativa.
								</p>
							)}
						</Card>

						{failedRowsCount > 0 ? (
							<Card className="space-y-4 p-4">
								<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
									<div>
										<h3 className="font-semibold">Linhas com falha</h3>
										<p className="text-muted-foreground text-sm">
											Edite os dados manualmente e escolha quais linhas devem
											ser reprocessadas ou ignoradas.
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => setAllFailedRowRetrySelection(true)}
											disabled={executeImportMutation.isPending}
										>
											Selecionar todas
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => setAllFailedRowRetrySelection(false)}
											disabled={executeImportMutation.isPending}
										>
											Ignorar todas
										</Button>
										<Button
											type="button"
											size="sm"
											onClick={handleRetryFailedRows}
											disabled={
												executeImportMutation.isPending ||
												retrySelectedRowsCount === 0
											}
										>
											{executeImportMutation.isPending ? (
												<Loader2 className="size-4 animate-spin" />
											) : (
												<Upload className="size-4" />
											)}
											{executeImportMutation.isPending
												? "Reprocessando..."
												: `Reprocessar selecionadas (${retrySelectedRowsCount})`}
										</Button>
									</div>
								</div>

								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Reprocessar</TableHead>
												<TableHead>Linha</TableHead>
												<TableHead>Ação</TableHead>
												<TableHead>Código</TableHead>
												<TableHead>Mensagem</TableHead>
												<TableHead>Atual no Excel</TableHead>
												<TableHead>Correção</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{failedRowsDrafts.map((failedRow) => {
												const failureField = failedRow.failure.field;
												const editorType =
													mapping && failureField
														? resolveFailedRowEditorType({
																failedRow,
																mapping,
															})
														: "NONE";
												const currentFieldValue = failureField
													? stringifyImportCellValue(
															failedRow.rowData[failureField],
														)
													: "";
												const excelFieldValue =
													failedRow.excelFieldValue?.trim() ?? "";
												const scopedProductOptions =
													editorType === "PRODUCT"
														? getParentScopedProductOptions({
																parentProductId:
																	mapping?.fixedValues.parentProductId,
																productOptions,
															})
														: productOptions;
												const sortedProductOptions =
													editorType === "PRODUCT"
														? sortProductOptionsByRelevance({
																rawValue: excelFieldValue,
																productOptions: scopedProductOptions,
															})
														: productOptions;
												const productCurrentValue =
													mapping &&
													failureField === mapping.fields.productColumn
														? productOptions.find(
																(product) => product.id === excelFieldValue,
															)
															: null;
												const selectedProductSuggestion =
													editorType === "PRODUCT"
														? scopedProductOptions.find(
																(product) =>
																	product.id === currentFieldValue.trim(),
															)
														: null;
												const currentExcelDisplayValue =
													excelFieldValue.length > 0
														? (productCurrentValue?.label ?? excelFieldValue)
														: "Vazio";

												return (
													<TableRow
														key={`failed-row-${failedRow.originalRowNumber}`}
														className={
															failedRow.shouldRetry ? undefined : "bg-muted/40"
														}
													>
														<TableCell>
															<Checkbox
																checked={failedRow.shouldRetry}
																onCheckedChange={(value) =>
																	updateFailedRowRetrySelection(
																		failedRow.originalRowNumber,
																		Boolean(value),
																	)
																}
																disabled={executeImportMutation.isPending}
																aria-label={`Reprocessar linha ${failedRow.originalRowNumber}`}
															/>
														</TableCell>
														<TableCell>{failedRow.originalRowNumber}</TableCell>
														<TableCell>
															{failedRow.shouldRetry
																? "Pronta para reprocessar"
																: "Ignorada"}
														</TableCell>
														<TableCell>{failedRow.failure.code}</TableCell>
														<TableCell className="max-w-[380px] whitespace-normal">
															{failedRow.failure.message}
														</TableCell>
														<TableCell className="min-w-[240px]">
															{!failureField ? (
																<p className="text-muted-foreground text-xs">
																	Campo não identificado
																</p>
															) : (
																<div className="space-y-1">
																	<p className="text-muted-foreground text-xs">
																		Campo: {failureField}
																	</p>
																	<p className="font-medium text-sm">
																		{currentExcelDisplayValue}
																	</p>
																</div>
															)}
														</TableCell>
														<TableCell className="min-w-[320px]">
															{!failureField ? (
																<p className="text-muted-foreground text-xs">
																	Sem campo automático para correção.
																</p>
															) : editorType === "PRODUCT" ? (
																<div className="space-y-1">
																	<p className="text-muted-foreground text-xs">
																		Campo: {failureField}
																	</p>
																{selectedProductSuggestion ? (
																	<p className="text-xs text-emerald-700">
																		Sugestão automática:{" "}
																		{selectedProductSuggestion.label}
																	</p>
																) : null}
																{mapping?.fixedValues.parentProductId ? (
																	<p className="text-muted-foreground text-xs">
																		Limitado ao produto da importação selecionado
																		mapeamento.
																	</p>
																) : null}
																<Select
																	value={resolveProductSelectValue({
																		rowValue: failedRow.rowData[failureField],
																		productOptions: scopedProductOptions,
																	})}
																	onValueChange={(value) =>
																		updateFailedRowProductValue(
																			failedRow.originalRowNumber,
																				failureField,
																				value,
																			)
																		}
																		disabled={executeImportMutation.isPending}
																	>
																		<SelectTrigger>
																			<SelectValue placeholder="Selecione o produto para corrigir" />
																		</SelectTrigger>
																		<SelectContent>
																			<SelectItem value={NONE_VALUE}>
																				Ignorar (sem correção)
																			</SelectItem>
																			{sortedProductOptions.map((product) => (
																				<SelectItem
																					key={product.id}
																					value={product.id}
																				>
																					{product.label}
																				</SelectItem>
																			))}
																		</SelectContent>
																	</Select>
																</div>
															) : (
																<div className="space-y-1">
																	<p className="text-muted-foreground text-xs">
																		Campo: {failureField}
																	</p>
																	<Input
																		value={stringifyImportCellValue(
																			failedRow.rowData[failureField],
																		)}
																		onChange={(event) =>
																			updateFailedRowCellValue(
																				failedRow.originalRowNumber,
																				failureField,
																				event.target.value,
																				editorType,
																			)
																		}
																		disabled={executeImportMutation.isPending}
																		placeholder={
																			editorType === "TOTAL_AMOUNT"
																				? "Ex.: 1.250,50"
																				: "Informe a correção"
																		}
																	/>
																</div>
															)}
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
								</div>
							</Card>
						) : null}

						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => setStep("MAPPING")}
							>
								Ajustar mapeamento
							</Button>
							<Button asChild>
								<Link to="/sales">Ir para vendas</Link>
							</Button>
						</div>
					</div>
				) : null}
			</Card>

			{templatesQuery.isFetching && step === "MAPPING" ? (
				<p className="text-muted-foreground text-sm">
					Buscando modelos compatíveis...
				</p>
			) : null}
			{isLoadingOptions && step === "MAPPING" ? (
				<p className="text-muted-foreground text-sm">
					Carregando opções de cadastro...
				</p>
			) : null}
		</main>
	);
}
