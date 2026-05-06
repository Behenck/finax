import type { Prisma } from "generated/prisma/client";
import { SaleStatus } from "generated/prisma/enums";
import {
	normalizeComparableMatchValue,
	normalizeMatchValue,
	readComparableDynamicFieldValueByLabel,
} from "./sale-import-match-utils";
import { assertImportRowsSecurity, parseImportSaleDate, sanitizeTextValue } from "./sale-import-utils";
import type {
	SaleDelinquencyImportPreviewRow,
	SaleDelinquencyImportTemplateMapping,
} from "./sale-delinquency-import-schemas";

type SaleCandidate = {
	id: string;
	status: SaleStatus;
	openDelinquencyMonths: Set<string>;
};

function parseInputText(rawValue: unknown) {
	const value = sanitizeTextValue(rawValue, { maxLength: 320 });
	if (!value) {
		return null;
	}

	return value;
}

function toDateOnly(value: Date) {
	return value.toISOString().slice(0, 10);
}

function buildMatchKey(saleDate: string, normalizedValues: string[]) {
	return `${saleDate}::${normalizedValues.join("::")}`;
}

function createPreviewSummary(rows: SaleDelinquencyImportPreviewRow[]) {
	let readyRows = 0;
	let noActionRows = 0;
	let attentionRows = 0;
	let errorRows = 0;

	for (const row of rows) {
		if (row.status === "READY") {
			readyRows += 1;
		} else if (row.status === "NO_ACTION") {
			noActionRows += 1;
		} else if (row.status === "ATTENTION") {
			attentionRows += 1;
		} else {
			errorRows += 1;
		}
	}

	return {
		totalRows: rows.length,
		readyRows,
		noActionRows,
		attentionRows,
		errorRows,
	};
}

function toCustomFieldValuesRow(params: {
	row: Record<string, unknown>;
	mapping: SaleDelinquencyImportTemplateMapping;
}) {
	return params.mapping.fields.customFieldMappings.map((customFieldMapping) => {
		const rawValue = parseInputText(params.row[customFieldMapping.columnKey]);
		return {
			customFieldLabel: customFieldMapping.customFieldLabel,
			value: rawValue,
		};
	});
}

export function isSaleDelinquencyImportPreviewRowReady(
	row: SaleDelinquencyImportPreviewRow,
) {
	return row.status === "READY" && row.action === "CREATE_DELINQUENCY";
}

export async function buildSaleDelinquencyImportPreview(params: {
	prismaClient: Pick<Prisma.TransactionClient, "sale">;
	organizationId: string;
	importDate: string;
	rows: Array<Record<string, unknown>>;
	mapping: SaleDelinquencyImportTemplateMapping;
}) {
	assertImportRowsSecurity(params.rows);

	const saleDateKeys = new Set<string>();
	for (const row of params.rows) {
		const parsedSaleDate = parseImportSaleDate(
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
						saleDelinquencies: {
							where: {
								resolvedAt: null,
							},
							select: {
								dueDate: true,
							},
						},
					},
				})
			: [];

	const customFieldMappingsNormalized =
		params.mapping.fields.customFieldMappings.map((customFieldMapping) => ({
			customFieldLabel: customFieldMapping.customFieldLabel,
			fieldLabelNormalized: normalizeMatchValue(
				customFieldMapping.customFieldLabel,
			),
			ignoreLeadingZerosForNumeric:
				normalizeMatchValue(customFieldMapping.customFieldLabel) === "grupo" ||
				normalizeMatchValue(customFieldMapping.customFieldLabel) === "cota",
		}));

	const salesByMatchKey = new Map<string, SaleCandidate[]>();
	for (const sale of sales) {
		const saleDate = toDateOnly(sale.saleDate);
		const normalizedCustomValues: string[] = [];
		let hasMissingField = false;

		for (const fieldMapping of customFieldMappingsNormalized) {
			const dynamicFieldValue = readComparableDynamicFieldValueByLabel({
				dynamicFieldSchema: sale.dynamicFieldSchema as Prisma.JsonValue,
				dynamicFieldValues: sale.dynamicFieldValues as Prisma.JsonValue,
				fieldLabelNormalized: fieldMapping.fieldLabelNormalized,
				ignoreLeadingZerosForNumeric:
					fieldMapping.ignoreLeadingZerosForNumeric,
			});

			if (!dynamicFieldValue) {
				hasMissingField = true;
				break;
			}

			normalizedCustomValues.push(dynamicFieldValue);
		}

		if (hasMissingField) {
			continue;
		}

		const matchKey = buildMatchKey(saleDate, normalizedCustomValues);
		const existing = salesByMatchKey.get(matchKey) ?? [];
		existing.push({
			id: sale.id,
			status: sale.status,
			openDelinquencyMonths: new Set(
				sale.saleDelinquencies.map((delinquency) =>
					delinquency.dueDate.toISOString().slice(0, 7),
				),
			),
		});
		salesByMatchKey.set(matchKey, existing);
	}

	const importMonth = params.importDate.slice(0, 7);
	const selectedSaleMonthKeys = new Set<string>();

	const rows = params.rows.map<SaleDelinquencyImportPreviewRow>((row, rowIndex) => {
		const rowNumber = rowIndex + 1;
		const saleDate = parseImportSaleDate(row[params.mapping.fields.saleDateColumn]);
		const customFieldValues = toCustomFieldValuesRow({
			row,
			mapping: params.mapping,
		});

		if (!saleDate) {
			return {
				rowNumber,
				status: "ERROR",
				action: "NONE",
				reason:
					"Data da venda inválida na linha. Use formatos como YYYY-MM-DD ou DD/MM/YYYY.",
				saleDate: null,
				dueDate: null,
				saleId: null,
				saleStatus: null,
				customFieldValues,
				matchCount: 0,
				matchedSaleIds: [],
			};
		}

		const normalizedCustomValues: string[] = [];
		for (const customFieldValue of customFieldValues) {
			if (!customFieldValue.value) {
				return {
					rowNumber,
					status: "ERROR",
					action: "NONE",
					reason: `Campo personalizado obrigatório ausente: ${customFieldValue.customFieldLabel}.`,
					saleDate,
					dueDate: null,
					saleId: null,
					saleStatus: null,
					customFieldValues,
					matchCount: 0,
					matchedSaleIds: [],
				};
			}

			const fieldMapping = customFieldMappingsNormalized.find(
				(mapping) =>
					mapping.customFieldLabel === customFieldValue.customFieldLabel,
			);

			normalizedCustomValues.push(
				normalizeComparableMatchValue(customFieldValue.value, {
					ignoreLeadingZerosForNumeric:
						fieldMapping?.ignoreLeadingZerosForNumeric,
				}),
			);
		}

		const matchKey = buildMatchKey(saleDate, normalizedCustomValues);
		const matchedSales = salesByMatchKey.get(matchKey) ?? [];
		const matchedSaleIds = matchedSales.map((matchedSale) => matchedSale.id);

		if (matchedSales.length === 0) {
			return {
				rowNumber,
				status: "ATTENTION",
				action: "NONE",
				reason: "Nenhuma venda encontrada com os critérios informados na linha.",
				saleDate,
				dueDate: null,
				saleId: null,
				saleStatus: null,
				customFieldValues,
				matchCount: 0,
				matchedSaleIds,
			};
		}

		if (matchedSales.length > 1) {
			return {
				rowNumber,
				status: "ATTENTION",
				action: "NONE",
				reason:
					"Mais de uma venda encontrada para os critérios da linha. Ajuste os campos de busca.",
				saleDate,
				dueDate: null,
				saleId: null,
				saleStatus: null,
				customFieldValues,
				matchCount: matchedSales.length,
				matchedSaleIds,
			};
		}

		const [sale] = matchedSales;
		if (!sale) {
			return {
				rowNumber,
				status: "ATTENTION",
				action: "NONE",
				reason: "Venda não encontrada.",
				saleDate,
				dueDate: null,
				saleId: null,
				saleStatus: null,
				customFieldValues,
				matchCount: matchedSales.length,
				matchedSaleIds,
			};
		}

		if (sale.status !== SaleStatus.COMPLETED) {
			return {
				rowNumber,
				status: "ATTENTION",
				action: "NONE",
				reason: "Venda encontrada, mas não está com status COMPLETED.",
				saleDate,
				dueDate: null,
				saleId: sale.id,
				saleStatus: sale.status,
				customFieldValues,
				matchCount: 1,
				matchedSaleIds,
			};
		}

		if (sale.openDelinquencyMonths.has(importMonth)) {
			return {
				rowNumber,
				status: "NO_ACTION",
				action: "NONE",
				reason:
					"A venda já possui inadimplência aberta no mesmo mês/ano da importação.",
				saleDate,
				dueDate: params.importDate,
				saleId: sale.id,
				saleStatus: sale.status,
				customFieldValues,
				matchCount: 1,
				matchedSaleIds,
			};
		}

		const saleMonthKey = `${sale.id}:${importMonth}`;
		if (selectedSaleMonthKeys.has(saleMonthKey)) {
			return {
				rowNumber,
				status: "NO_ACTION",
				action: "NONE",
				reason:
					"Linha duplicada no lote para a mesma venda e mês/ano de importação.",
				saleDate,
				dueDate: params.importDate,
				saleId: sale.id,
				saleStatus: sale.status,
				customFieldValues,
				matchCount: 1,
				matchedSaleIds,
			};
		}

		selectedSaleMonthKeys.add(saleMonthKey);

		return {
			rowNumber,
			status: "READY",
			action: "CREATE_DELINQUENCY",
			reason: "Linha pronta para criar inadimplência.",
			saleDate,
			dueDate: params.importDate,
			saleId: sale.id,
			saleStatus: sale.status,
			customFieldValues,
			matchCount: 1,
			matchedSaleIds,
		};
	});

	return {
		summary: createPreviewSummary(rows),
		rows,
	};
}
