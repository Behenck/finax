import type {
	CommissionReceiptImportApplyResult,
	CommissionReceiptImportPreviewRow,
	CommissionReceiptImportTemplateFields,
} from "@/schemas/types/commission-receipt-import";

const GROUP_ALIASES = ["grupo"];
const QUOTA_ALIASES = ["cota"];
const SALE_DATE_ALIASES = [
	"data da venda",
	"data venda",
	"dt venda",
	"venda data",
];
const INSTALLMENT_ALIASES = ["parcela", "numero parcela", "n parcela"];
const RECEIVED_AMOUNT_ALIASES = [
	"valor_recebimento",
	"valor recebimento",
	"valor recebido",
	"recebimento",
];

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

export function buildSuggestedCommissionReceiptImportMapping(
	headers: string[],
): CommissionReceiptImportTemplateFields {
	return {
		saleDateColumn: findHeaderByAliases(headers, SALE_DATE_ALIASES),
		groupColumn: findHeaderByAliases(headers, GROUP_ALIASES),
		quotaColumn: findHeaderByAliases(headers, QUOTA_ALIASES),
		installmentColumn: findHeaderByAliases(headers, INSTALLMENT_ALIASES),
		receivedAmountColumn: findHeaderByAliases(headers, RECEIVED_AMOUNT_ALIASES),
	};
}

export function parseInstallmentReferenceNumber(value: unknown) {
	if (typeof value === "number" && Number.isInteger(value) && value > 0) {
		return value;
	}

	if (typeof value !== "string") {
		return null;
	}

	const normalized = value.trim().replace(/\s+/g, " ");
	if (!normalized) {
		return null;
	}

	if (/^\d+$/.test(normalized)) {
		const parsed = Number(normalized);
		return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
	}

	const composed = normalized.match(/^(\d+)\s*(?:\/|de)\s*(\d+)$/i);
	if (composed) {
		const parsed = Number(composed[1]);
		return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
	}

	return null;
}

export function isCommissionReceiptPreviewRowReady(
	row: CommissionReceiptImportPreviewRow,
) {
	return (
		row.status === "READY" &&
		(row.action === "MARK_AS_PAID" ||
			row.action === "UPDATE_AMOUNT_AND_MARK_AS_PAID")
	);
}

export function shouldAutoSelectCommissionReceiptPreviewRow(
	row: CommissionReceiptImportPreviewRow,
) {
	return row.status === "READY" && row.action === "MARK_AS_PAID";
}

export interface CommissionReceiptImportResultComparisonRow {
	rowNumber: number;
	result: "APPLIED" | "SKIPPED";
	reason: string;
	saleDate: string | null;
	groupValue: string | null;
	quotaValue: string | null;
	installmentText: string | null;
	beforeStatus: CommissionReceiptImportPreviewRow["installmentStatus"];
	afterStatus: CommissionReceiptImportPreviewRow["installmentStatus"];
	beforeAmount: number | null;
	afterAmount: number | null;
	appliedPaymentDate: string | null;
	statusChanged: boolean;
	amountChanged: boolean;
}

export function buildCommissionReceiptImportResultRows(params: {
	previewRows: CommissionReceiptImportPreviewRow[];
	applyRows: CommissionReceiptImportApplyResult["results"];
	importDate: string;
}) {
	const previewRowsByNumber = new Map(
		params.previewRows.map((previewRow) => [previewRow.rowNumber, previewRow]),
	);

	return params.applyRows.map<CommissionReceiptImportResultComparisonRow>(
		(applyRow) => {
			const previewRow = previewRowsByNumber.get(applyRow.rowNumber);

			if (!previewRow) {
				return {
					rowNumber: applyRow.rowNumber,
					result: applyRow.result,
					reason: applyRow.reason,
					saleDate: null,
					groupValue: null,
					quotaValue: null,
					installmentText: null,
					beforeStatus: null,
					afterStatus: null,
					beforeAmount: null,
					afterAmount: null,
					appliedPaymentDate:
						applyRow.result === "APPLIED" ? params.importDate : null,
					statusChanged: false,
					amountChanged: false,
				};
			}

			const beforeStatus = previewRow.installmentStatus;
			const beforeAmount = previewRow.installmentAmount;
			let afterStatus = beforeStatus;
			let afterAmount = beforeAmount;
			let appliedPaymentDate: string | null = null;

			if (applyRow.result === "APPLIED") {
				appliedPaymentDate = params.importDate;

				if (previewRow.action === "MARK_AS_PAID") {
					afterStatus = "PAID";
				} else if (previewRow.action === "UPDATE_AMOUNT_AND_MARK_AS_PAID") {
					afterStatus = "PAID";
					afterAmount = previewRow.receivedAmount;
				}
			}

			return {
				rowNumber: applyRow.rowNumber,
				result: applyRow.result,
				reason: applyRow.reason,
				saleDate: previewRow.saleDate,
				groupValue: previewRow.groupValue,
				quotaValue: previewRow.quotaValue,
				installmentText: previewRow.installmentText,
				beforeStatus,
				afterStatus,
				beforeAmount,
				afterAmount,
				appliedPaymentDate,
				statusChanged: beforeStatus !== afterStatus,
				amountChanged: beforeAmount !== afterAmount,
			};
		},
	);
}
