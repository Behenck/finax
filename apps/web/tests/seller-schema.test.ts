import { describe, expect, it } from "vitest";
import { sellerSchema } from "../src/schemas/seller-schema";

describe("sellerSchema", () => {
	it("accepts seller without email and document", () => {
		const result = sellerSchema.safeParse({
			name: "Vendedor Opcional",
			email: "",
			phone: "55999999999",
			companyName: "Empresa LTDA",
			documentType: undefined,
			document: "",
			country: "BR",
			state: "RS",
		});

		expect(result.success).toBe(true);
	});

	it("requires document type when document is provided", () => {
		const result = sellerSchema.safeParse({
			name: "Vendedor Opcional",
			email: "",
			phone: "55999999999",
			companyName: "Empresa LTDA",
			documentType: undefined,
			document: "12345678901",
			country: "BR",
			state: "RS",
		});

		expect(result.success).toBe(false);
		expect(result.error?.flatten().fieldErrors.documentType).toContain(
			"Selecione o tipo do documento",
		);
	});

	it("validates email only when it is filled", () => {
		const result = sellerSchema.safeParse({
			name: "Vendedor Opcional",
			email: "invalido",
			phone: "55999999999",
			companyName: "Empresa LTDA",
			documentType: undefined,
			document: "",
			country: "BR",
			state: "RS",
		});

		expect(result.success).toBe(false);
		expect(result.error?.flatten().fieldErrors.email).toContain("Email inválido");
	});
});
