import z from "zod";

export type QuickCustomerDocumentType = "CPF" | "CNPJ";

function toDigitsOnly(value: string) {
	return value.replace(/\D/g, "");
}

export function normalizeQuickCustomerName(value: string) {
	return value
		.toLocaleLowerCase("pt-BR")
		.replace(
			/(^|[\s.]+)([^\s.])/gu,
			(_match, prefix: string, character: string) =>
				`${prefix}${character.toLocaleUpperCase("pt-BR")}`,
		);
}

export function resolveQuickCustomerDocumentType(
	value: string,
): QuickCustomerDocumentType | null {
	const digitsLength = toDigitsOnly(value).length;
	if (digitsLength === 11) {
		return "CPF";
	}

	if (digitsLength === 14) {
		return "CNPJ";
	}

	return null;
}

export function resolveQuickCustomerDocumentMaskType(
	value: string,
): QuickCustomerDocumentType {
	return toDigitsOnly(value).length > 11 ? "CNPJ" : "CPF";
}

export const quickCustomerSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Nome obrigatório")
		.transform(normalizeQuickCustomerName),
	documentNumber: z
		.string()
		.trim()
		.min(1, "CPF/CNPJ obrigatório")
		.refine(
			(value) => resolveQuickCustomerDocumentType(value) !== null,
			"CPF/CNPJ inválido",
		),
	phone: z
		.string()
		.optional()
		.or(z.literal(""))
		.refine(
			(value) =>
				!value ||
				value.replace(/\D/g, "").length === 10 ||
				value.replace(/\D/g, "").length === 11,
			"Celular inválido",
		),
});

export type QuickCustomerInput = z.input<typeof quickCustomerSchema>;
export type QuickCustomerData = z.infer<typeof quickCustomerSchema>;
