import { describe, expect, it } from "vitest";
import {
	normalizeQuickCustomerName,
	quickCustomerSchema,
	resolveQuickCustomerDocumentType,
} from "@/pages/_app/sales/-components/sale-form/quick-customer-schema";

describe("quick-customer-schema", () => {
	it("should resolve CPF and CNPJ from document number", () => {
		expect(resolveQuickCustomerDocumentType("123.456.789-01")).toBe("CPF");
		expect(resolveQuickCustomerDocumentType("12.345.678/0001-90")).toBe("CNPJ");
	});

	it("should return null for invalid document length", () => {
		expect(resolveQuickCustomerDocumentType("123.456.789-0")).toBeNull();
	});

	it("should validate both CPF and CNPJ in quick customer schema", () => {
		const cpfResult = quickCustomerSchema.safeParse({
			name: "Cliente PF",
			documentNumber: "123.456.789-01",
			phone: "",
		});
		const cnpjResult = quickCustomerSchema.safeParse({
			name: "Cliente PJ",
			documentNumber: "12.345.678/0001-90",
			phone: "",
		});

		expect(cpfResult.success).toBe(true);
		expect(cnpjResult.success).toBe(true);
	});

	it("should normalize customer name to title case after spaces and dots", () => {
		expect(normalizeQuickCustomerName("JOAO DA.SILVA")).toBe("Joao Da.Silva");
		expect(normalizeQuickCustomerName("mARIA dE souZa")).toBe("Maria De Souza");
	});

	it("should transform schema output name to normalized title case", () => {
		const result = quickCustomerSchema.parse({
			name: "JOAO DA.SILVA",
			documentNumber: "123.456.789-01",
			phone: "",
		});

		expect(result.name).toBe("Joao Da.Silva");
	});
});
