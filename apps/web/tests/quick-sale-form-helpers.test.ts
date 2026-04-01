import { describe, expect, it } from "vitest";
import { quickSaleBatchSchema } from "@/schemas/sale-quick-batch-schema";
import type { SaleHierarchicalProductOption } from "@/hooks/sales/use-sale-form-options";
import {
	buildQuickSaleBatchPayload,
	canAddQuickSaleItem,
	canRemoveQuickSaleItem,
	resolveScopedItemProducts,
} from "../src/pages/_app/sales/-components/quick-sale-form-helpers";

const hierarchicalProductsFixture: SaleHierarchicalProductOption[] = [
	{
		id: "11111111-1111-4111-8111-111111111111",
		name: "Produto Pai A",
		path: ["Produto Pai A"],
		label: "Produto Pai A",
		rootId: "11111111-1111-4111-8111-111111111111",
		rootName: "Produto Pai A",
		depth: 0,
		relativeLabel: "Produto Pai A",
		fullLabel: "Produto Pai A",
	},
	{
		id: "22222222-2222-4222-8222-222222222222",
		name: "Subproduto A1",
		path: ["Produto Pai A", "Subproduto A1"],
		label: "Produto Pai A -> Subproduto A1",
		rootId: "11111111-1111-4111-8111-111111111111",
		rootName: "Produto Pai A",
		depth: 1,
		relativeLabel: "Subproduto A1",
		fullLabel: "Produto Pai A -> Subproduto A1",
	},
	{
		id: "33333333-3333-4333-8333-333333333333",
		name: "Produto Pai B",
		path: ["Produto Pai B"],
		label: "Produto Pai B",
		rootId: "33333333-3333-4333-8333-333333333333",
		rootName: "Produto Pai B",
		depth: 0,
		relativeLabel: "Produto Pai B",
		fullLabel: "Produto Pai B",
	},
];

describe("quick-sale-form helpers", () => {
	it("should build batch payload with currency/date/dynamic conversions", () => {
		const parsedValues = quickSaleBatchSchema.parse({
			parentProductId: "11111111-1111-4111-8111-111111111111",
			companyId: "55555555-5555-4555-8555-555555555555",
			unitId: "66666666-6666-4666-8666-666666666666",
			responsibleType: "SELLER",
			responsibleId: "77777777-7777-4777-8777-777777777777",
			items: [
				{
					customerId: "44444444-4444-4444-8444-444444444444",
					productId: "22222222-2222-4222-8222-222222222222",
					quantity: "1",
					saleDate: "2026-03-10",
					totalAmount: "R$ 1.500,00",
					dynamicFields: {
						"field-currency": "R$ 10,00",
						"field-text": "  Canal norte  ",
					},
				},
			],
		});

		const payload = buildQuickSaleBatchPayload({
			values: parsedValues,
			dynamicFieldSchemaByProductId: {
				"22222222-2222-4222-8222-222222222222": [
					{
						fieldId: "field-currency",
						label: "Valor adicional",
						type: "CURRENCY",
						required: false,
						options: [],
					},
					{
						fieldId: "field-text",
						label: "Observação",
						type: "TEXT",
						required: false,
						options: [],
					},
				],
			},
		});

		expect(payload.items).toHaveLength(1);
		expect(payload.items[0]?.customerId).toBe(
			"44444444-4444-4444-8444-444444444444",
		);
		expect(payload.items[0]?.totalAmount).toBe(150_000);
		expect(payload.items[0]?.saleDate).toBe("2026-03-10");
		expect(payload.items[0]?.dynamicFields).toEqual({
			"field-currency": 1_000,
			"field-text": "Canal norte",
		});
	});

	it("should replicate payload items based on quantity", () => {
		const parsedValues = quickSaleBatchSchema.parse({
			parentProductId: "11111111-1111-4111-8111-111111111111",
			companyId: "55555555-5555-4555-8555-555555555555",
			responsibleType: "SELLER",
			responsibleId: "77777777-7777-4777-8777-777777777777",
			items: [
				{
					customerId: "44444444-4444-4444-8444-444444444444",
					productId: "22222222-2222-4222-8222-222222222222",
					quantity: "3",
					saleDate: "2026-03-10",
					totalAmount: "R$ 500,00",
					dynamicFields: {},
				},
			],
		});

		const payload = buildQuickSaleBatchPayload({
			values: parsedValues,
			dynamicFieldSchemaByProductId: {},
		});

		expect(payload.items).toHaveLength(3);
		expect(payload.items.every((item) => item.totalAmount === 50_000)).toBe(
			true,
		);
		expect(
			payload.items.every(
				(item) => item.customerId === "44444444-4444-4444-8444-444444444444",
			),
		).toBe(true);
		expect(
			payload.items.every(
				(item) => item.productId === "22222222-2222-4222-8222-222222222222",
			),
		).toBe(true);
	});

	it("should scope item products to parent plus descendants only", () => {
		const options = resolveScopedItemProducts(
			"11111111-1111-4111-8111-111111111111",
			hierarchicalProductsFixture,
		);

		expect(options.map((option) => option.id)).toEqual([
			"11111111-1111-4111-8111-111111111111",
			"22222222-2222-4222-8222-222222222222",
		]);
	});

	it("should enforce add/remove item constraints", () => {
		expect(canAddQuickSaleItem(49)).toBe(true);
		expect(canAddQuickSaleItem(50)).toBe(false);
		expect(canRemoveQuickSaleItem(1)).toBe(false);
		expect(canRemoveQuickSaleItem(2)).toBe(true);
	});
});
