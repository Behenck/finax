import type { Prisma } from "generated/prisma/client";
import {
	SaleCommissionDirection,
	SaleCommissionInstallmentStatus,
	SaleStatus,
} from "generated/prisma/enums";
import type {
	CommissionReceiptImportPreviewRow,
	CommissionReceiptImportTemplateMapping,
} from "./commission-receipt-import-schemas";
import {
	normalizeComparableMatchValue,
	readComparableDynamicFieldValueByLabel,
} from "./sale-import-match-utils";
import {
	assertImportRowsSecurity,
	sanitizeTextValue,
} from "./sale-import-utils";

const GROUP_LABEL_NORMALIZED = "grupo";
const QUOTA_LABEL_NORMALIZED = "cota";

function parseReceivedAmountToCents(rawValue: unknown) {
	if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
		if (rawValue === 0) {
			return 0;
		}

		if (rawValue > 0) {
			return Math.round((rawValue + Number.EPSILON) * 100);
		}

		return -Math.round((Math.abs(rawValue) + Number.EPSILON) * 100);
	}

	const value = sanitizeTextValue(rawValue, { maxLength: 120 });
	if (!value) {
		return null;
	}

	const signCandidate = value.replace(/\s+/g, "").replace(/[^\d,.\-+]/g, "");
	if (!signCandidate) {
		return null;
	}

	let sign = 1;
	let unsignedValue = signCandidate;
	if (unsignedValue.startsWith("-")) {
		sign = -1;
		unsignedValue = unsignedValue.slice(1);
	} else if (unsignedValue.startsWith("+")) {
		unsignedValue = unsignedValue.slice(1);
	}

	if (
		!unsignedValue ||
		unsignedValue.includes("-") ||
		unsignedValue.includes("+")
	) {
		return null;
	}

	const numericValue = unsignedValue.replace(/[^\d.,]/g, "");
	if (!numericValue || !/\d/.test(numericValue)) {
		return null;
	}

	let normalized = numericValue;
	const hasComma = numericValue.includes(",");
	const hasDot = numericValue.includes(".");

	if (hasComma && hasDot) {
		const lastComma = numericValue.lastIndexOf(",");
		const lastDot = numericValue.lastIndexOf(".");
		const decimalSeparator = lastComma > lastDot ? "," : ".";
		const thousandSeparator = decimalSeparator === "," ? "." : ",";

		const withoutThousand = numericValue.split(thousandSeparator).join("");
		const decimalParts = withoutThousand.split(decimalSeparator);
		if (decimalParts.length !== 2) {
			return null;
		}

		const [integerPart, fractionPart] = decimalParts;
		if (!integerPart || !fractionPart) {
			return null;
		}

		if (!/^\d+$/.test(integerPart) || !/^\d+$/.test(fractionPart)) {
			return null;
		}

		normalized = `${integerPart}.${fractionPart}`;
	} else if (hasComma || hasDot) {
		const separator = hasComma ? "," : ".";
		const parts = numericValue.split(separator);

		if (parts.length === 2) {
			const [leftPart, rightPart] = parts;
			if (!leftPart || !rightPart) {
				return null;
			}

			if (!/^\d+$/.test(leftPart) || !/^\d+$/.test(rightPart)) {
				return null;
			}

			if (rightPart.length <= 2) {
				normalized = `${leftPart}.${rightPart}`;
			} else if (rightPart.length === 3) {
				normalized = `${leftPart}${rightPart}`;
			} else {
				return null;
			}
		} else if (parts.length > 2) {
			const lastPart = parts[parts.length - 1] ?? "";
			if (!lastPart) {
				return null;
			}

			if (lastPart.length <= 2) {
				const integerPart = parts.slice(0, -1).join("");
				if (!integerPart || !/^\d+$/.test(integerPart)) {
					return null;
				}
				if (!/^\d+$/.test(lastPart)) {
					return null;
				}
				normalized = `${integerPart}.${lastPart}`;
			} else {
				const integerPart = parts.join("");
				if (!integerPart || !/^\d+$/.test(integerPart)) {
					return null;
				}
				normalized = integerPart;
			}
		}
	}

	const parsedNumber = Number(normalized);
	if (!Number.isFinite(parsedNumber)) {
		return null;
	}

	const signedParsedNumber = sign * parsedNumber;

	if (signedParsedNumber === 0) {
		return 0;
	}

	if (signedParsedNumber > 0) {
		return Math.round((signedParsedNumber + Number.EPSILON) * 100);
	}

	return -Math.round((Math.abs(signedParsedNumber) + Number.EPSILON) * 100);
}

function parseInstallmentNumber(rawValue: unknown) {
	if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
		if (!Number.isInteger(rawValue) || rawValue <= 0) {
			return null;
		}

		return rawValue;
	}

	const value = sanitizeTextValue(rawValue, { maxLength: 120 });
	if (!value) {
		return null;
	}

	if (/^\d+$/.test(value)) {
		const parsed = Number(value);
		if (!Number.isInteger(parsed) || parsed <= 0) {
			return null;
		}

		return parsed;
	}

	const normalized = value.replace(/\s+/g, " ").trim();
	const composedMatch = normalized.match(/^(\d+)\s*(?:\/|de)\s*(\d+)$/i);
	if (composedMatch) {
		const parsed = Number(composedMatch[1]);
		if (!Number.isInteger(parsed) || parsed <= 0) {
			return null;
		}

		return parsed;
	}

	const numericTokens = normalized.match(/\d+/g) ?? [];
	if (numericTokens.length === 1) {
		const parsed = Number(numericTokens[0]);
		if (!Number.isInteger(parsed) || parsed <= 0) {
			return null;
		}
		return parsed;
	}

	if (numericTokens.length === 2 && /(\/|\bde\b)/i.test(normalized)) {
		const parsed = Number(numericTokens[0]);
		if (!Number.isInteger(parsed) || parsed <= 0) {
			return null;
		}
		return parsed;
	}

	return null;
}

function isValidSaleDateKey(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}

	const parsed = new Date(`${value}T00:00:00.000Z`);
	return (
		!Number.isNaN(parsed.getTime()) &&
		parsed.toISOString().slice(0, 10) === value
	);
}

function normalizeParsedSaleDate(value: Date) {
	if (Number.isNaN(value.getTime())) {
		return null;
	}

	const normalized = value.toISOString().slice(0, 10);
	return isValidSaleDateKey(normalized) ? normalized : null;
}

function excelSerialToUtcDate(rawValue: number) {
	if (!Number.isFinite(rawValue)) {
		return null;
	}

	const integerPart = Math.trunc(rawValue);
	const fractionalPart = rawValue - integerPart;
	const baseDate = Date.UTC(1899, 11, 30);
	const dateMs = baseDate + integerPart * 86_400_000;
	const timeMs = Math.round(fractionalPart * 86_400_000);
	const parsed = new Date(dateMs + timeMs);

	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed;
}

function parseSaleDateFromImportRow(rawValue: unknown) {
	if (rawValue instanceof Date) {
		return normalizeParsedSaleDate(rawValue);
	}

	if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
		const parsedFromSerial = excelSerialToUtcDate(rawValue);
		if (!parsedFromSerial) {
			return null;
		}
		return normalizeParsedSaleDate(parsedFromSerial);
	}

	const sanitized = sanitizeTextValue(rawValue, { maxLength: 120 });
	if (!sanitized) {
		return null;
	}

	if (isValidSaleDateKey(sanitized)) {
		return sanitized;
	}

	const isoDatePrefixMatch = sanitized.match(/^(\d{4}-\d{2}-\d{2})T/i);
	if (isoDatePrefixMatch?.[1] && isValidSaleDateKey(isoDatePrefixMatch[1])) {
		return isoDatePrefixMatch[1];
	}

	const brDateMatch = sanitized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
	if (brDateMatch?.[1] && brDateMatch[2] && brDateMatch[3]) {
		const day = brDateMatch[1].padStart(2, "0");
		const month = brDateMatch[2].padStart(2, "0");
		const year = brDateMatch[3];
		const normalized = `${year}-${month}-${day}`;
		return isValidSaleDateKey(normalized) ? normalized : null;
	}

	if (/^-?\d+(?:[.,]\d+)?$/.test(sanitized)) {
		const normalizedNumeric = sanitized.replace(",", ".");
		const parsedNumeric = Number(normalizedNumeric);
		if (!Number.isFinite(parsedNumeric)) {
			return null;
		}

		const parsedFromSerial = excelSerialToUtcDate(parsedNumeric);
		if (!parsedFromSerial) {
			return null;
		}

		return normalizeParsedSaleDate(parsedFromSerial);
	}

	return null;
}

function parseInputText(rawValue: unknown) {
	const value = sanitizeTextValue(rawValue, { maxLength: 320 });
	if (!value) {
		return null;
	}

	return value;
}

type SaleInstallmentCandidate = {
	id: string;
	originInstallmentId: string | null;
	saleCommissionId: string;
	installmentNumber: number;
	status: SaleCommissionInstallmentStatus;
	amount: number;
};

type SaleCandidate = {
	id: string;
	saleDate: string;
	status: SaleStatus;
	incomeInstallments: SaleInstallmentCandidate[];
};

function buildMatchKey(
	saleDate: string,
	groupValueNormalized: string,
	quotaValueNormalized: string,
) {
	return `${saleDate}::${groupValueNormalized}::${quotaValueNormalized}`;
}

function createPreviewRow(params: {
	rowNumber: number;
	status: CommissionReceiptImportPreviewRow["status"];
	action: CommissionReceiptImportPreviewRow["action"];
	reason: string;
	saleDate: string | null;
	groupValue: string | null;
	quotaValue: string | null;
	installmentText: string | null;
	receivedAmount: number | null;
	saleId?: string | null;
	saleStatus?: string | null;
	installmentId?: string | null;
	installmentNumber?: number | null;
	installmentStatus?: SaleCommissionInstallmentStatus | null;
	installmentAmount?: number | null;
}): CommissionReceiptImportPreviewRow {
	return {
		rowNumber: params.rowNumber,
		status: params.status,
		action: params.action,
		reason: params.reason,
		saleDate: params.saleDate,
		groupValue: params.groupValue,
		quotaValue: params.quotaValue,
		installmentText: params.installmentText,
		receivedAmount: params.receivedAmount,
		saleId: params.saleId ?? null,
		saleStatus: params.saleStatus ?? null,
		installmentId: params.installmentId ?? null,
		installmentNumber: params.installmentNumber ?? null,
		installmentStatus: params.installmentStatus ?? null,
		installmentAmount: params.installmentAmount ?? null,
	};
}

export async function buildCommissionReceiptImportPreview(params: {
	prismaClient: Pick<
		Prisma.TransactionClient,
		"sale" | "saleCommissionInstallment" | "saleCommission"
	>;
	organizationId: string;
	rows: Array<Record<string, unknown>>;
	mapping: CommissionReceiptImportTemplateMapping;
}) {
	assertImportRowsSecurity(params.rows);

	const saleDateKeys = new Set<string>();
	for (const row of params.rows) {
		const parsedSaleDate = parseSaleDateFromImportRow(
			row[params.mapping.fields.saleDateColumn],
		);
		if (parsedSaleDate) {
			saleDateKeys.add(parsedSaleDate);
		}
	}

	const saleDates = Array.from(saleDateKeys).map(
		(saleDate) => new Date(`${saleDate}T00:00:00.000Z`),
	);

	const sales =
		saleDates.length > 0
			? await params.prismaClient.sale.findMany({
					where: {
						organizationId: params.organizationId,
						saleDate: {
							in: saleDates,
						},
					},
					select: {
						id: true,
						saleDate: true,
						status: true,
						dynamicFieldSchema: true,
						dynamicFieldValues: true,
						commissions: {
							where: {
								direction: SaleCommissionDirection.INCOME,
							},
							select: {
								id: true,
								installments: {
									select: {
										id: true,
										originInstallmentId: true,
										installmentNumber: true,
										status: true,
										amount: true,
									},
								},
							},
						},
					},
				})
			: [];

	const salesByDynamicKey = new Map<string, SaleCandidate[]>();
	for (const sale of sales) {
		const saleDate = normalizeParsedSaleDate(sale.saleDate);
		if (!saleDate) {
			continue;
		}

		const groupValue = readComparableDynamicFieldValueByLabel({
			dynamicFieldSchema: sale.dynamicFieldSchema as Prisma.JsonValue,
			dynamicFieldValues: sale.dynamicFieldValues as Prisma.JsonValue,
			fieldLabelNormalized: GROUP_LABEL_NORMALIZED,
			ignoreLeadingZerosForNumeric: true,
		});
		const quotaValue = readComparableDynamicFieldValueByLabel({
			dynamicFieldSchema: sale.dynamicFieldSchema as Prisma.JsonValue,
			dynamicFieldValues: sale.dynamicFieldValues as Prisma.JsonValue,
			fieldLabelNormalized: QUOTA_LABEL_NORMALIZED,
			ignoreLeadingZerosForNumeric: true,
		});

		if (!groupValue || !quotaValue) {
			continue;
		}

		const key = buildMatchKey(saleDate, groupValue, quotaValue);
		const existing = salesByDynamicKey.get(key) ?? [];
		existing.push({
			id: sale.id,
			saleDate,
			status: sale.status,
			incomeInstallments: sale.commissions.flatMap((commission) =>
				commission.installments.map((installment) => ({
					id: installment.id,
					originInstallmentId: installment.originInstallmentId,
					saleCommissionId: commission.id,
					installmentNumber: installment.installmentNumber,
					status: installment.status,
					amount: installment.amount,
				})),
			),
		});
		salesByDynamicKey.set(key, existing);
	}

	const rows = params.rows.map((row, rowIndex) => {
		const rowNumber = rowIndex + 1;
		const saleDate = parseSaleDateFromImportRow(
			row[params.mapping.fields.saleDateColumn],
		);
		const groupValue = parseInputText(row[params.mapping.fields.groupColumn]);
		const quotaValue = parseInputText(row[params.mapping.fields.quotaColumn]);
		const installmentText = parseInputText(
			row[params.mapping.fields.installmentColumn],
		);
		const receivedAmount = parseReceivedAmountToCents(
			row[params.mapping.fields.receivedAmountColumn],
		);
		const installmentNumber = parseInstallmentNumber(
			row[params.mapping.fields.installmentColumn],
		);

		if (!saleDate) {
			return createPreviewRow({
				rowNumber,
				status: "ERROR",
				action: "NONE",
				reason:
					"Data da venda inválida na linha. Use formatos como YYYY-MM-DD ou DD/MM/YYYY.",
				saleDate: null,
				groupValue,
				quotaValue,
				installmentText,
				receivedAmount,
			});
		}

		if (!groupValue) {
			return createPreviewRow({
				rowNumber,
				status: "ERROR",
				action: "NONE",
				reason: "Campo grupo é obrigatório na linha.",
				saleDate,
				groupValue,
				quotaValue,
				installmentText,
				receivedAmount,
			});
		}

		if (!quotaValue) {
			return createPreviewRow({
				rowNumber,
				status: "ERROR",
				action: "NONE",
				reason: "Campo cota é obrigatório na linha.",
				saleDate,
				groupValue,
				quotaValue,
				installmentText,
				receivedAmount,
			});
		}

		if (!installmentText || installmentNumber === null) {
			return createPreviewRow({
				rowNumber,
				status: "ERROR",
				action: "NONE",
				reason: "Parcela inválida. Use formatos como 01/01, 01 de 01 ou 1.",
				saleDate,
				groupValue,
				quotaValue,
				installmentText,
				receivedAmount,
			});
		}

		if (receivedAmount === null) {
			return createPreviewRow({
				rowNumber,
				status: "ERROR",
				action: "NONE",
				reason: "Valor de recebimento inválido.",
				saleDate,
				groupValue,
				quotaValue,
				installmentText,
				receivedAmount,
			});
		}

		if (receivedAmount === 0) {
			return createPreviewRow({
				rowNumber,
				status: "NO_ACTION",
				action: "NONE",
				reason: "Valor zero. Sem ação automática.",
				saleDate,
				groupValue,
				quotaValue,
				installmentText,
				receivedAmount,
			});
		}

		const normalizedGroupValue = normalizeComparableMatchValue(groupValue, {
			ignoreLeadingZerosForNumeric: true,
		});
		const normalizedQuotaValue = normalizeComparableMatchValue(quotaValue, {
			ignoreLeadingZerosForNumeric: true,
		});
		const matchKey = buildMatchKey(
			saleDate,
			normalizedGroupValue,
			normalizedQuotaValue,
		);
		const matchedSales = salesByDynamicKey.get(matchKey) ?? [];

		if (matchedSales.length === 0) {
			return createPreviewRow({
				rowNumber,
				status: "ATTENTION",
				action: "NONE",
				reason: "Nenhuma venda encontrada para grupo/cota na data informada.",
				saleDate,
				groupValue,
				quotaValue,
				installmentText,
				receivedAmount,
			});
		}

		if (matchedSales.length > 1) {
			return createPreviewRow({
				rowNumber,
				status: "ATTENTION",
				action: "NONE",
				reason:
					"Mais de uma venda encontrada para grupo/cota na data informada.",
				saleDate,
				groupValue,
				quotaValue,
				installmentText,
				receivedAmount,
			});
		}

		const [sale] = matchedSales;

		if (
			sale.status === SaleStatus.PENDING ||
			sale.status === SaleStatus.CANCELED
		) {
			return createPreviewRow({
				rowNumber,
				status: "ATTENTION",
				action: "NONE",
				reason:
					"Venda não permite alteração automática de parcelas (pendente/cancelada).",
				saleDate,
				groupValue,
				quotaValue,
				installmentText,
				receivedAmount,
				saleId: sale.id,
				saleStatus: sale.status,
				installmentNumber,
			});
		}

		const matchedInstallments = sale.incomeInstallments.filter(
			(installment) =>
				installment.installmentNumber === installmentNumber &&
				installment.originInstallmentId === null,
		);

		if (matchedInstallments.length === 0) {
			return createPreviewRow({
				rowNumber,
				status: "ATTENTION",
				action: "NONE",
				reason:
					"Parcela não encontrada nas comissões de entrada (INCOME) da venda.",
				saleDate,
				groupValue,
				quotaValue,
				installmentText,
				receivedAmount,
				saleId: sale.id,
				saleStatus: sale.status,
				installmentNumber,
			});
		}

		if (matchedInstallments.length > 1) {
			return createPreviewRow({
				rowNumber,
				status: "ATTENTION",
				action: "NONE",
				reason:
					"Mais de uma parcela encontrada com o mesmo número. Revise manualmente.",
				saleDate,
				groupValue,
				quotaValue,
				installmentText,
				receivedAmount,
				saleId: sale.id,
				saleStatus: sale.status,
				installmentNumber,
			});
		}

		const [installment] = matchedInstallments;

		if (receivedAmount < 0) {
			if (installment.status === SaleCommissionInstallmentStatus.REVERSED) {
				return createPreviewRow({
					rowNumber,
					status: "ATTENTION",
					action: "NONE",
					reason:
						"Parcela já está estornada no sistema. Revise manualmente antes de aplicar novo estorno.",
					saleDate,
					groupValue,
					quotaValue,
					installmentText,
					receivedAmount,
					saleId: sale.id,
					saleStatus: sale.status,
					installmentId: installment.id,
					installmentNumber: installment.installmentNumber,
					installmentStatus: installment.status,
					installmentAmount: installment.amount,
				});
			}

			if (
				installment.status !== SaleCommissionInstallmentStatus.PENDING &&
				installment.status !== SaleCommissionInstallmentStatus.PAID
			) {
				return createPreviewRow({
					rowNumber,
					status: "ATTENTION",
					action: "NONE",
					reason: "Status da parcela não permite estorno automático.",
					saleDate,
					groupValue,
					quotaValue,
					installmentText,
					receivedAmount,
					saleId: sale.id,
					saleStatus: sale.status,
					installmentId: installment.id,
					installmentNumber: installment.installmentNumber,
					installmentStatus: installment.status,
					installmentAmount: installment.amount,
				});
			}

			const hasLaterPaidInstallment = sale.incomeInstallments.some(
				(candidate) =>
					candidate.originInstallmentId === null &&
					candidate.installmentNumber > installment.installmentNumber &&
					candidate.status === SaleCommissionInstallmentStatus.PAID,
			);

			if (hasLaterPaidInstallment) {
				return createPreviewRow({
					rowNumber,
					status: "ATTENTION",
					action: "NONE",
					reason:
						"Não é possível estornar esta parcela porque existe parcela posterior já paga.",
					saleDate,
					groupValue,
					quotaValue,
					installmentText,
					receivedAmount,
					saleId: sale.id,
					saleStatus: sale.status,
					installmentId: installment.id,
					installmentNumber: installment.installmentNumber,
					installmentStatus: installment.status,
					installmentAmount: installment.amount,
				});
			}

			const existingReversedAmountAbsolute = sale.incomeInstallments
				.filter(
					(candidate) =>
						candidate.originInstallmentId === installment.id &&
						candidate.status === SaleCommissionInstallmentStatus.REVERSED,
				)
				.reduce((sum, candidate) => sum + Math.abs(candidate.amount), 0);
				const nextReversalAmountAbsolute = Math.abs(receivedAmount);
				if (
					existingReversedAmountAbsolute + nextReversalAmountAbsolute >
					installment.amount
				) {
				return createPreviewRow({
					rowNumber,
					status: "ATTENTION",
					action: "NONE",
					reason: "Valor de estorno excede o valor disponível da parcela base.",
					saleDate,
					groupValue,
					quotaValue,
					installmentText,
					receivedAmount,
					saleId: sale.id,
					saleStatus: sale.status,
					installmentId: installment.id,
					installmentNumber: installment.installmentNumber,
					installmentStatus: installment.status,
					installmentAmount: installment.amount,
					});
				}

				const isFullDirectReversal =
					existingReversedAmountAbsolute === 0 &&
					nextReversalAmountAbsolute === installment.amount;

				return createPreviewRow({
					rowNumber,
					status: "READY",
					action: "REVERSE_INSTALLMENT",
					reason: isFullDirectReversal
						? "Linha pronta para estornar totalmente a parcela base diretamente."
						: "Linha pronta para criar movimento de estorno parcial da parcela base.",
					saleDate,
					groupValue,
					quotaValue,
					installmentText,
				receivedAmount,
				saleId: sale.id,
				saleStatus: sale.status,
				installmentId: installment.id,
				installmentNumber: installment.installmentNumber,
				installmentStatus: installment.status,
				installmentAmount: installment.amount,
			});
		}

		if (installment.status !== SaleCommissionInstallmentStatus.PENDING) {
			return createPreviewRow({
				rowNumber,
				status: "NO_ACTION",
				action: "NONE",
				reason: "Parcela já está paga, cancelada ou estornada.",
				saleDate,
				groupValue,
				quotaValue,
				installmentText,
				receivedAmount,
				saleId: sale.id,
				saleStatus: sale.status,
				installmentId: installment.id,
				installmentNumber: installment.installmentNumber,
				installmentStatus: installment.status,
				installmentAmount: installment.amount,
			});
		}

		if (installment.amount !== receivedAmount) {
			return createPreviewRow({
				rowNumber,
				status: "READY",
				action: "UPDATE_AMOUNT_AND_MARK_AS_PAID",
				reason:
					"Valor recebido difere do valor da parcela no sistema. Se selecionada, a parcela será atualizada e marcada como paga.",
				saleDate,
				groupValue,
				quotaValue,
				installmentText,
				receivedAmount,
				saleId: sale.id,
				saleStatus: sale.status,
				installmentId: installment.id,
				installmentNumber: installment.installmentNumber,
				installmentStatus: installment.status,
				installmentAmount: installment.amount,
			});
		}

		return createPreviewRow({
			rowNumber,
			status: "READY",
			action: "MARK_AS_PAID",
			reason: "Linha pronta para aplicar pagamento.",
			saleDate,
			groupValue,
			quotaValue,
			installmentText,
			receivedAmount,
			saleId: sale.id,
			saleStatus: sale.status,
			installmentId: installment.id,
			installmentNumber: installment.installmentNumber,
			installmentStatus: installment.status,
			installmentAmount: installment.amount,
		});
	});

	const summary = rows.reduce(
		(accumulator, row) => {
			if (row.status === "READY") {
				accumulator.readyRows += 1;
			} else if (row.status === "NO_ACTION") {
				accumulator.noActionRows += 1;
			} else if (row.status === "ATTENTION") {
				accumulator.attentionRows += 1;
			} else if (row.status === "ERROR") {
				accumulator.errorRows += 1;
			}

			return accumulator;
		},
		{
			totalRows: rows.length,
			readyRows: 0,
			noActionRows: 0,
			attentionRows: 0,
			errorRows: 0,
		},
	);

	return {
		rows,
		summary,
	};
}
