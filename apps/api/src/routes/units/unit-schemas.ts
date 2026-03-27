import z from "zod";

export const unitAddressFieldsSchema = {
	country: z.string().optional(),
	state: z.string().optional(),
	city: z.string().optional(),
	street: z.string().optional(),
	zipCode: z.string().optional(),
	neighborhood: z.string().optional(),
	number: z.string().optional(),
	complement: z.string().optional(),
};

export const unitMutationBodySchema = z.object({
	name: z.string(),
	...unitAddressFieldsSchema,
});

export const unitResponseSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	country: z.string().nullable(),
	state: z.string().nullable(),
	city: z.string().nullable(),
	street: z.string().nullable(),
	zipCode: z.string().nullable(),
	neighborhood: z.string().nullable(),
	number: z.string().nullable(),
	complement: z.string().nullable(),
});

function normalizeOptionalString(value: string | undefined) {
	const normalized = value?.trim();
	if (!normalized) {
		return undefined;
	}

	return normalized;
}

export type UnitMutationBody = z.infer<typeof unitMutationBodySchema>;

export function normalizeUnitMutationBody(
	data: UnitMutationBody,
): UnitMutationBody {
	return {
		name: data.name.trim(),
		country: normalizeOptionalString(data.country),
		state: normalizeOptionalString(data.state),
		city: normalizeOptionalString(data.city),
		street: normalizeOptionalString(data.street),
		zipCode: normalizeOptionalString(data.zipCode),
		neighborhood: normalizeOptionalString(data.neighborhood),
		number: normalizeOptionalString(data.number),
		complement: normalizeOptionalString(data.complement),
	};
}
