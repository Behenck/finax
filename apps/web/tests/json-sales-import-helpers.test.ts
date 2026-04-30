import { describe, expect, it } from "vitest";
import {
	buildSuggestedJsonDynamicFieldMappings,
	collectJsonSalesImportKeys,
	normalizeJsonImportSearchValue,
	parseJsonSalesImportContent,
} from "../src/pages/_app/sales/-components/import-sales/json-sales-import-helpers";

describe("json sales import helpers", () => {
	it("should parse the cotas root and collect only scalar top-level keys", () => {
		const parsed = parseJsonSalesImportContent(
			"vendas.json",
			JSON.stringify({
				cotas: [
					{
						cota: 5134,
						grupo: "1533",
						credito: 1_100_000,
						cliente: { nome: "Guilherme" },
						vendedor: { email: "financeiro@finaxgi.com.br" },
						comissoes: { terceiros: [] },
						metadados: { origem: "api" },
					},
				],
			}),
		);

		expect(parsed).toEqual({
			fileName: "vendas.json",
			cotas: [
				expect.objectContaining({
					cota: 5134,
					grupo: "1533",
					credito: 1_100_000,
				}),
			],
			jsonKeys: ["cota", "credito", "grupo"],
		});
	});

	it("should reject payloads without valid cotas", () => {
		expect(() =>
			parseJsonSalesImportContent("vendas.json", JSON.stringify({ rows: [] })),
		).toThrow("JSON inválido");
		expect(() =>
			parseJsonSalesImportContent("vendas.json", JSON.stringify({ cotas: [] })),
		).toThrow("JSON sem cotas válidas");
	});

	it("should normalize accents and whitespace for mapping suggestions", () => {
		expect(normalizeJsonImportSearchValue("  Porcentágem   Amortização ")).toBe(
			"porcentagem amortizacao",
		);
	});

	it("should suggest dynamic field mappings by normalized label", () => {
		const mapping = buildSuggestedJsonDynamicFieldMappings({
			fields: [
				{ id: "field-cota", label: "Cota" },
				{ id: "field-amortizacao", label: "Porcentagem Amortização" },
				{ id: "field-extra", label: "Campo Extra" },
			],
			jsonKeys: ["cota", "porcentagem_amortizacao", "grupo"],
			currentMappings: { "field-extra": "grupo" },
		});

		expect(mapping).toEqual({
			"field-amortizacao": "porcentagem_amortizacao",
			"field-cota": "cota",
			"field-extra": "grupo",
		});
	});

	it("should collect keys from the first 50 cotas only", () => {
		const cotas = Array.from({ length: 51 }, (_, index) => ({
			[`campo_${index}`]: index,
		}));

		expect(collectJsonSalesImportKeys(cotas)).not.toContain("campo_50");
	});
});
