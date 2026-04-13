import { describe, expect, it } from "vitest";
import type { SaleDelinquencyImportPreviewRow } from "../src/schemas/types/sale-delinquency-import";
import {
	buildAutoSelectedSaleDelinquencyRowNumbers,
	buildSaleDelinquencyImportResultRows,
	buildSaleDelinquencyPreviewUiRows,
	buildSuggestedSaleDelinquencyImportMapping,
	isSaleDelinquencyPreviewRowReady,
	normalizeImportHeader,
} from "../src/pages/_app/sales/-components/import-delinquency/sale-delinquency-import-helpers";

function createPreviewRow(
	overrides?: Partial<SaleDelinquencyImportPreviewRow>,
): SaleDelinquencyImportPreviewRow {
	return {
		rowNumber: 1,
		status: "READY",
		action: "CREATE_DELINQUENCY",
		reason: "Linha pronta para criar inadimplência.",
		saleDate: "2026-03-15",
		dueDate: "2026-04-10",
		saleId: "sale-id-1",
		saleStatus: "COMPLETED",
		customFieldValues: [
			{
				customFieldLabel: "Grupo",
				value: "A",
			},
		],
		matchCount: 1,
		matchedSaleIds: ["sale-id-1"],
		...overrides,
	};
}

describe("sale delinquency import helpers", () => {
	it("should normalize import header values", () => {
		expect(normalizeImportHeader("  Dátã   da Venda  ")).toBe("data da venda");
	});

	it("should suggest mapping using sale date aliases and matching custom field labels", () => {
		const mapping = buildSuggestedSaleDelinquencyImportMapping({
			headers: ["Data da Venda", "Grupo", "Cota", "Observações"],
			customFieldLabels: ["Grupo", "Cota", "Setor"],
		});

		expect(mapping).toEqual({
			saleDateColumn: "Data da Venda",
			customFieldMappings: [
				{
					customFieldLabel: "Grupo",
					columnKey: "Grupo",
				},
				{
					customFieldLabel: "Cota",
					columnKey: "Cota",
				},
			],
		});
	});

	it("should identify ready rows and auto-select only READY rows", () => {
		const readyRow = createPreviewRow();
		const noActionRow = createPreviewRow({
			rowNumber: 2,
			status: "NO_ACTION",
			action: "NONE",
			reason: "Linha duplicada no lote para a mesma venda e mês/ano de importação.",
		});

		expect(isSaleDelinquencyPreviewRowReady(readyRow)).toBe(true);
		expect(isSaleDelinquencyPreviewRowReady(noActionRow)).toBe(false);
		expect(
			buildAutoSelectedSaleDelinquencyRowNumbers([readyRow, noActionRow]),
		).toEqual([1]);
	});

	it("should mark NO_ACTION duplicated rows as visual duplicates when matching a READY row in same sale/month", () => {
		const rows = buildSaleDelinquencyPreviewUiRows([
			createPreviewRow({
				rowNumber: 1,
				status: "READY",
				action: "CREATE_DELINQUENCY",
			}),
			createPreviewRow({
				rowNumber: 2,
				status: "NO_ACTION",
				action: "NONE",
				reason: "Linha duplicada no lote para a mesma venda e mês/ano de importação.",
			}),
			createPreviewRow({
				rowNumber: 3,
				saleId: "sale-id-2",
				status: "NO_ACTION",
				action: "NONE",
				reason: "A venda já possui inadimplência aberta no mesmo mês/ano da importação.",
			}),
		]);

		expect(rows[0]?.isVisualDuplicate).toBe(false);
		expect(rows[1]?.isVisualDuplicate).toBe(true);
		expect(rows[2]?.isVisualDuplicate).toBe(false);
	});

	it("should transform preview/apply result rows for UI", () => {
		const resultRows = buildSaleDelinquencyImportResultRows({
			previewRows: [
				createPreviewRow({
					rowNumber: 1,
					customFieldValues: [
						{ customFieldLabel: "Grupo", value: "A" },
						{ customFieldLabel: "Cota", value: "101" },
					],
				}),
			],
			applyRows: [
				{
					rowNumber: 1,
					result: "APPLIED",
					reason: "Inadimplência criada com sucesso.",
					saleId: "sale-id-1",
					delinquencyId: "delinquency-id-1",
				},
				{
					rowNumber: 2,
					result: "SKIPPED",
					reason: "Linha não encontrada na prévia.",
					saleId: null,
					delinquencyId: null,
				},
			],
		});

		expect(resultRows[0]).toMatchObject({
			rowNumber: 1,
			result: "APPLIED",
			saleDate: "2026-03-15",
			dueDate: "2026-04-10",
			status: "READY",
			action: "CREATE_DELINQUENCY",
			customFieldSummary: "Grupo: A | Cota: 101",
		});
		expect(resultRows[1]).toMatchObject({
			rowNumber: 2,
			result: "SKIPPED",
			saleDate: null,
			dueDate: null,
			customFieldSummary: "-",
		});
	});
});
