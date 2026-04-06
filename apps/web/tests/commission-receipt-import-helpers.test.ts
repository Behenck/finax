import { describe, expect, it } from "vitest";
import {
	buildCommissionReceiptImportResultRows,
	buildSuggestedCommissionReceiptImportMapping,
	isCommissionReceiptPreviewRowReady,
	parseInstallmentReferenceNumber,
	shouldAutoSelectCommissionReceiptPreviewRow,
} from "../src/pages/_app/commissions/-components/commission-receipt-import-helpers";
import type { CommissionReceiptImportPreviewRow } from "../src/schemas/types/commission-receipt-import";

describe("commission receipt import helpers", () => {
	function createPreviewRow(
		overrides?: Partial<CommissionReceiptImportPreviewRow>,
	): CommissionReceiptImportPreviewRow {
		return {
			rowNumber: 1,
			status: "READY",
			action: "MARK_AS_PAID",
			reason: "ok",
			saleDate: "2026-03-15",
			groupValue: "Grupo A",
			quotaValue: "001",
			installmentText: "01/01",
			receivedAmount: 15_000,
			saleId: "sale-id-1",
			saleStatus: "APPROVED",
			installmentId: "installment-id-1",
			installmentNumber: 1,
			installmentStatus: "PENDING",
			installmentAmount: 15_000,
			...overrides,
		};
	}

	it("should parse installment references in flexible formats", () => {
		expect(parseInstallmentReferenceNumber("01/01")).toBe(1);
		expect(parseInstallmentReferenceNumber("01 de 01")).toBe(1);
		expect(parseInstallmentReferenceNumber("1")).toBe(1);
		expect(parseInstallmentReferenceNumber(2)).toBe(2);
		expect(parseInstallmentReferenceNumber("abc")).toBeNull();
	});

	it("should suggest mapping from headers", () => {
		const mapping = buildSuggestedCommissionReceiptImportMapping([
			"Data da Venda",
			"Grupo",
			"Cota",
			"Parcela",
			"Valor Recebimento",
		]);

		expect(mapping).toEqual({
			saleDateColumn: "Data da Venda",
			groupColumn: "Grupo",
			quotaColumn: "Cota",
			installmentColumn: "Parcela",
			receivedAmountColumn: "Valor Recebimento",
		});
	});

	it("should avoid mapping generic valor column as received amount", () => {
		const mapping = buildSuggestedCommissionReceiptImportMapping([
			"Data da Venda",
			"Grupo",
			"Cota",
			"Parcela",
			"Valor Total",
		]);

		expect(mapping.saleDateColumn).toBe("Data da Venda");
		expect(mapping.receivedAmountColumn).toBe("");
	});

	it("should identify ready preview rows", () => {
		expect(
			isCommissionReceiptPreviewRowReady({
				rowNumber: 1,
				status: "READY",
				action: "MARK_AS_PAID",
				reason: "ok",
				saleDate: null,
				groupValue: null,
				quotaValue: null,
				installmentText: null,
				receivedAmount: null,
				saleId: null,
				saleStatus: null,
				installmentId: null,
				installmentNumber: null,
				installmentStatus: null,
				installmentAmount: null,
			}),
		).toBe(true);

		expect(
			isCommissionReceiptPreviewRowReady({
				rowNumber: 10,
				status: "READY",
				action: "UPDATE_AMOUNT_AND_MARK_AS_PAID",
				reason: "ok",
				saleDate: null,
				groupValue: null,
				quotaValue: null,
				installmentText: null,
				receivedAmount: null,
				saleId: null,
				saleStatus: null,
				installmentId: null,
				installmentNumber: null,
				installmentStatus: null,
				installmentAmount: null,
			}),
		).toBe(true);

		expect(
			isCommissionReceiptPreviewRowReady({
				rowNumber: 11,
				status: "READY",
				action: "REVERSE_INSTALLMENT",
				reason: "ok",
				saleDate: null,
				groupValue: null,
				quotaValue: null,
				installmentText: null,
				receivedAmount: null,
				saleId: null,
				saleStatus: null,
				installmentId: null,
				installmentNumber: null,
				installmentStatus: null,
				installmentAmount: null,
			}),
		).toBe(true);

		expect(
			isCommissionReceiptPreviewRowReady({
				rowNumber: 2,
				status: "ATTENTION",
				action: "NONE",
				reason: "x",
				saleDate: null,
				groupValue: null,
				quotaValue: null,
				installmentText: null,
				receivedAmount: null,
				saleId: null,
				saleStatus: null,
				installmentId: null,
				installmentNumber: null,
				installmentStatus: null,
				installmentAmount: null,
			}),
		).toBe(false);
	});

	it("should auto-select only pure mark-as-paid rows", () => {
		expect(
			shouldAutoSelectCommissionReceiptPreviewRow({
				rowNumber: 1,
				status: "READY",
				action: "MARK_AS_PAID",
				reason: "ok",
				saleDate: null,
				groupValue: null,
				quotaValue: null,
				installmentText: null,
				receivedAmount: null,
				saleId: null,
				saleStatus: null,
				installmentId: null,
				installmentNumber: null,
				installmentStatus: null,
				installmentAmount: null,
			}),
		).toBe(true);

		expect(
			shouldAutoSelectCommissionReceiptPreviewRow({
				rowNumber: 2,
				status: "READY",
				action: "UPDATE_AMOUNT_AND_MARK_AS_PAID",
				reason: "ok",
				saleDate: null,
				groupValue: null,
				quotaValue: null,
				installmentText: null,
				receivedAmount: null,
				saleId: null,
				saleStatus: null,
				installmentId: null,
				installmentNumber: null,
				installmentStatus: null,
				installmentAmount: null,
			}),
		).toBe(false);

		expect(
			shouldAutoSelectCommissionReceiptPreviewRow({
				rowNumber: 3,
				status: "READY",
				action: "REVERSE_INSTALLMENT",
				reason: "ok",
				saleDate: null,
				groupValue: null,
				quotaValue: null,
				installmentText: null,
				receivedAmount: null,
				saleId: null,
				saleStatus: null,
				installmentId: null,
				installmentNumber: null,
				installmentStatus: null,
				installmentAmount: null,
			}),
		).toBe(false);
	});

	it("should build result rows with before/after comparison for applied actions", () => {
		const rows = buildCommissionReceiptImportResultRows({
			previewRows: [
				createPreviewRow({
					rowNumber: 1,
					action: "MARK_AS_PAID",
					installmentAmount: 21_000,
					receivedAmount: 21_000,
				}),
				createPreviewRow({
					rowNumber: 2,
					action: "UPDATE_AMOUNT_AND_MARK_AS_PAID",
					installmentAmount: 24_000,
					receivedAmount: 28_000,
				}),
				createPreviewRow({
					rowNumber: 3,
					action: "REVERSE_INSTALLMENT",
					installmentStatus: "PAID",
					installmentAmount: 20_000,
					receivedAmount: -13_000,
				}),
			],
			applyRows: [
				{
					rowNumber: 1,
					result: "APPLIED",
					reason: "Parcela marcada como paga com sucesso.",
					installmentId: "installment-id-1",
					saleId: "sale-id-1",
				},
				{
					rowNumber: 2,
					result: "APPLIED",
					reason: "Parcela atualizada e marcada como paga com sucesso.",
					installmentId: "installment-id-2",
					saleId: "sale-id-2",
				},
				{
					rowNumber: 3,
					result: "APPLIED",
					reason: "Movimento de estorno criado com sucesso.",
					installmentId: "installment-id-3",
					saleId: "sale-id-3",
				},
			],
			importDate: "2026-03-15",
		});

		expect(rows[0]).toMatchObject({
			rowNumber: 1,
			beforeStatus: "PENDING",
			afterStatus: "PAID",
			beforeAmount: 21_000,
			afterAmount: 21_000,
			appliedPaymentDate: "2026-03-15",
			statusChanged: true,
			amountChanged: false,
		});
		expect(rows[1]).toMatchObject({
			rowNumber: 2,
			beforeStatus: "PENDING",
			afterStatus: "PAID",
			beforeAmount: 24_000,
			afterAmount: 28_000,
			appliedPaymentDate: "2026-03-15",
			statusChanged: true,
			amountChanged: true,
		});
		expect(rows[2]).toMatchObject({
			rowNumber: 3,
			beforeStatus: "PAID",
			afterStatus: "PAID",
			beforeAmount: 20_000,
			afterAmount: 20_000,
			appliedPaymentDate: "2026-03-15",
			statusChanged: false,
			amountChanged: false,
		});
	});

	it("should keep before/after equal on skipped row and handle missing preview row", () => {
		const rows = buildCommissionReceiptImportResultRows({
			previewRows: [
				createPreviewRow({
					rowNumber: 3,
					installmentStatus: "PAID",
					installmentAmount: 9_000,
				}),
			],
			applyRows: [
				{
					rowNumber: 3,
					result: "SKIPPED",
					reason: "Linha não está pronta para aplicação.",
					installmentId: "installment-id-3",
					saleId: "sale-id-3",
				},
				{
					rowNumber: 99,
					result: "SKIPPED",
					reason: "Linha não encontrada na prévia.",
					installmentId: null,
					saleId: null,
				},
			],
			importDate: "2026-03-15",
		});

		expect(rows[0]).toMatchObject({
			rowNumber: 3,
			beforeStatus: "PAID",
			afterStatus: "PAID",
			beforeAmount: 9_000,
			afterAmount: 9_000,
			appliedPaymentDate: null,
			statusChanged: false,
			amountChanged: false,
		});
		expect(rows[1]).toMatchObject({
			rowNumber: 99,
			saleDate: null,
			groupValue: null,
			quotaValue: null,
			installmentText: null,
			beforeStatus: null,
			afterStatus: null,
			beforeAmount: null,
			afterAmount: null,
			appliedPaymentDate: null,
		});
	});
});
