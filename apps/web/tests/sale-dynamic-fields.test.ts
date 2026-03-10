import { describe, expect, it } from "vitest";
import type { SaleDynamicFieldSchemaItem } from "@/schemas/types/sale-dynamic-fields";
import {
	formatSaleDynamicFieldValue,
	toSaleDynamicFieldFormValues,
	toSaleDynamicFieldPayloadValues,
} from "../src/pages/_app/sales/-components/sale-dynamic-fields";

const schema: SaleDynamicFieldSchemaItem[] = [
	{
		fieldId: "field-text",
		label: "Grupo",
		type: "TEXT",
		required: true,
		options: [],
	},
	{
		fieldId: "field-currency",
		label: "Valor",
		type: "CURRENCY",
		required: true,
		options: [],
	},
	{
		fieldId: "field-select",
		label: "Etapa",
		type: "SELECT",
		required: true,
		options: [
			{ id: "option-a", label: "Inbound" },
			{ id: "option-b", label: "Outbound" },
		],
	},
	{
		fieldId: "field-date",
		label: "Data",
		type: "DATE",
		required: false,
		options: [],
	},
	{
		fieldId: "field-datetime",
		label: "Data e hora",
		type: "DATE_TIME",
		required: false,
		options: [],
	},
];

describe("sale-dynamic-fields", () => {
	it("should map persisted values to form values", () => {
		const formValues = toSaleDynamicFieldFormValues(schema, {
			"field-text": "Grupo Norte",
			"field-currency": 250_000,
			"field-select": "option-a",
			"field-date": "2026-03-10",
			"field-datetime": "2026-03-10T15:30:00.000Z",
		});

		expect(formValues["field-text"]).toBe("Grupo Norte");
		expect(formValues["field-currency"]).toMatch(/R\$\s*2\.500,00/u);
		expect(formValues["field-select"]).toBe("option-a");
		expect(formValues["field-date"]).toBe("2026-03-10");
		expect(typeof formValues["field-datetime"]).toBe("string");
	});

	it("should map form values to payload values", () => {
		const payloadValues = toSaleDynamicFieldPayloadValues(schema, {
			"field-text": " Grupo Sul ",
			"field-currency": "R$ 3.000,00",
			"field-select": "option-b",
			"field-date": "2026-03-15",
			"field-datetime": "2026-03-15T13:45",
		});

		expect(payloadValues["field-text"]).toBe("Grupo Sul");
		expect(payloadValues["field-currency"]).toBe(300_000);
		expect(payloadValues["field-select"]).toBe("option-b");
		expect(payloadValues["field-date"]).toBe("2026-03-15");
		expect(typeof payloadValues["field-datetime"]).toBe("string");
	});

	it("should format select and currency values for display", () => {
		const currencyValue = formatSaleDynamicFieldValue(schema[1], 400_000);
		const selectValue = formatSaleDynamicFieldValue(schema[2], "option-a");
		const emptyValue = formatSaleDynamicFieldValue(schema[0], null);

		expect(currencyValue).toMatch(/R\$\s*4\.000,00/u);
		expect(selectValue).toBe("Inbound");
		expect(emptyValue).toBe("vazio");
	});
});
