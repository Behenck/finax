import z from "zod";

export const companyMutationBodySchema = z.object({
	name: z.string(),
	cnpj: z.string().optional(),
});

function normalizeOptionalString(value: string | undefined) {
	const normalized = value?.trim();
	if (!normalized) {
		return undefined;
	}

	return normalized;
}

function normalizeCnpj(value: string | undefined) {
	const normalized = normalizeOptionalString(value);
	if (!normalized) {
		return undefined;
	}

	const digits = normalized.replace(/\D/g, "").slice(0, 14);
	if (!digits) {
		return undefined;
	}

	return digits;
}

export type CompanyMutationBody = z.infer<typeof companyMutationBodySchema>;

export function normalizeCompanyMutationBody(
	data: CompanyMutationBody,
): CompanyMutationBody {
	return {
		name: data.name.trim(),
		cnpj: normalizeCnpj(data.cnpj),
	};
}
