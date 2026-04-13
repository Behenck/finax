import type {
	SaleDelinquencyImportApplyResult,
	SaleDelinquencyImportPreviewRow,
	SaleDelinquencyImportTemplateFields,
} from "@/schemas/types/sale-delinquency-import";

const SALE_DATE_ALIASES = [
	"data da venda",
	"data venda",
	"dt venda",
	"venda data",
	"data_venda",
];

export interface SaleDelinquencyPreviewUiRow
	extends SaleDelinquencyImportPreviewRow {
	isVisualDuplicate: boolean;
}

export interface SaleDelinquencyImportResultComparisonRow {
	rowNumber: number;
	result: "APPLIED" | "SKIPPED";
	reason: string;
	saleId: string | null;
	delinquencyId: string | null;
	saleDate: string | null;
	dueDate: string | null;
	status: SaleDelinquencyImportPreviewRow["status"] | null;
	action: SaleDelinquencyImportPreviewRow["action"] | null;
	customFieldSummary: string;
}

export function normalizeImportHeader(value: string) {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}

function findHeaderByAliases(headers: string[], aliases: string[]) {
	const normalizedHeaders = headers.map((header) => ({
		header,
		normalized: normalizeImportHeader(header),
	}));

	for (const alias of aliases) {
		const normalizedAlias = normalizeImportHeader(alias);
		const exact = normalizedHeaders.find(
			(candidate) => candidate.normalized === normalizedAlias,
		);
		if (exact) {
			return exact.header;
		}

		const partial = normalizedHeaders.find((candidate) =>
			candidate.normalized.includes(normalizedAlias),
		);
		if (partial) {
			return partial.header;
		}
	}

	return "";
}

function findBestHeaderForField(headers: string[], fieldLabel: string) {
	const normalizedFieldLabel = normalizeImportHeader(fieldLabel);
	if (!normalizedFieldLabel) {
		return "";
	}

	const normalizedHeaders = headers.map((header) => ({
		header,
		normalized: normalizeImportHeader(header),
	}));

	const exactMatch = normalizedHeaders.find(
		(header) => header.normalized === normalizedFieldLabel,
	);
	if (exactMatch) {
		return exactMatch.header;
	}

	const partialMatch = normalizedHeaders.find(
		(header) =>
			header.normalized.includes(normalizedFieldLabel) ||
			normalizedFieldLabel.includes(header.normalized),
	);
	if (partialMatch) {
		return partialMatch.header;
	}

	return "";
}

export function buildSuggestedSaleDelinquencyImportMapping(params: {
	headers: string[];
	customFieldLabels: string[];
}): SaleDelinquencyImportTemplateFields {
	const usedHeaders = new Set<string>();
	const saleDateColumn = findHeaderByAliases(params.headers, SALE_DATE_ALIASES);
	if (saleDateColumn) {
		usedHeaders.add(saleDateColumn);
	}

	const customFieldMappings = params.customFieldLabels
		.map((customFieldLabel) => {
			const suggestedHeader = findBestHeaderForField(
				params.headers,
				customFieldLabel,
			);
			if (!suggestedHeader || usedHeaders.has(suggestedHeader)) {
				return null;
			}

			usedHeaders.add(suggestedHeader);
			return {
				customFieldLabel,
				columnKey: suggestedHeader,
			};
		})
		.filter((mapping): mapping is { customFieldLabel: string; columnKey: string } =>
			Boolean(mapping),
		);

	return {
		saleDateColumn,
		customFieldMappings,
	};
}

export function isSaleDelinquencyPreviewRowReady(
	row: SaleDelinquencyImportPreviewRow,
) {
	return row.status === "READY" && row.action === "CREATE_DELINQUENCY";
}

export function shouldAutoSelectSaleDelinquencyPreviewRow(
	row: SaleDelinquencyImportPreviewRow,
) {
	return isSaleDelinquencyPreviewRowReady(row);
}

export function buildSaleDelinquencyPreviewUiRows(
	rows: SaleDelinquencyImportPreviewRow[],
): SaleDelinquencyPreviewUiRow[] {
	const readyKeys = new Set<string>();

	for (const row of rows) {
		if (
			isSaleDelinquencyPreviewRowReady(row) &&
			row.saleId &&
			row.dueDate
		) {
			readyKeys.add(`${row.saleId}:${row.dueDate}`);
		}
	}

	return rows.map((row) => {
		const rowKey =
			row.saleId && row.dueDate ? `${row.saleId}:${row.dueDate}` : null;
		const isVisualDuplicate =
			row.status === "NO_ACTION" &&
			Boolean(rowKey) &&
			readyKeys.has(rowKey ?? "") &&
			row.reason.toLowerCase().includes("duplicada");

		return {
			...row,
			isVisualDuplicate,
		};
	});
}

export function buildAutoSelectedSaleDelinquencyRowNumbers(
	rows: SaleDelinquencyImportPreviewRow[],
) {
	return rows
		.filter((row) => shouldAutoSelectSaleDelinquencyPreviewRow(row))
		.map((row) => row.rowNumber);
}

function formatCustomFieldSummary(
	customFieldValues: SaleDelinquencyImportPreviewRow["customFieldValues"],
) {
	if (!customFieldValues.length) {
		return "-";
	}

	return customFieldValues
		.map((fieldValue) => `${fieldValue.customFieldLabel}: ${fieldValue.value ?? "-"}`)
		.join(" | ");
}

export function buildSaleDelinquencyImportResultRows(params: {
	previewRows: SaleDelinquencyImportPreviewRow[];
	applyRows: SaleDelinquencyImportApplyResult["results"];
}) {
	const previewRowsByNumber = new Map(
		params.previewRows.map((previewRow) => [previewRow.rowNumber, previewRow]),
	);

	return params.applyRows.map<SaleDelinquencyImportResultComparisonRow>(
		(applyRow) => {
			const previewRow = previewRowsByNumber.get(applyRow.rowNumber);

			if (!previewRow) {
				return {
					rowNumber: applyRow.rowNumber,
					result: applyRow.result,
					reason: applyRow.reason,
					saleId: applyRow.saleId,
					delinquencyId: applyRow.delinquencyId,
					saleDate: null,
					dueDate: null,
					status: null,
					action: null,
					customFieldSummary: "-",
				};
			}

			return {
				rowNumber: applyRow.rowNumber,
				result: applyRow.result,
				reason: applyRow.reason,
				saleId: applyRow.saleId,
				delinquencyId: applyRow.delinquencyId,
				saleDate: previewRow.saleDate,
				dueDate: previewRow.dueDate,
				status: previewRow.status,
				action: previewRow.action,
				customFieldSummary: formatCustomFieldSummary(previewRow.customFieldValues),
			};
		},
	);
}
