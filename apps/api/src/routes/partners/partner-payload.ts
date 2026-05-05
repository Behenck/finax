import { PartnerDocumentType, PartnerStatus } from "generated/prisma/enums";
import z from "zod";

export const partnerWriteBodySchema = z
	.object({
		name: z.string().optional(),
		email: z.string().optional(),
		phone: z.string().optional(),
		companyName: z.string().trim().min(1),
		documentType: z.enum(PartnerDocumentType).optional(),
		document: z.string().optional(),
		country: z.string().trim().min(1),
		state: z.string().trim().min(1),
		city: z.string().optional(),
		street: z.string().optional(),
		zipCode: z.string().optional(),
		neighborhood: z.string().optional(),
		number: z.string().optional(),
		complement: z.string().optional(),
		status: z.enum(PartnerStatus).optional(),
		supervisorIds: z.array(z.uuid()).optional(),
	})
	.superRefine((data, context) => {
		const document = normalizeOptionalText(data.document);

		if (document && !data.documentType) {
			context.addIssue({
				code: "custom",
				message:
					"Tipo de documento é obrigatório quando o documento é informado",
				path: ["documentType"],
			});
		}
	});

export type PartnerWriteBody = z.infer<typeof partnerWriteBodySchema>;

export function normalizeOptionalText(value?: string | null) {
	const normalized = value?.trim();

	return normalized ? normalized : null;
}

function normalizeRequiredText(value: string) {
	return value.trim();
}

export function normalizePartnerWriteBody(data: PartnerWriteBody) {
	const document = normalizeOptionalText(data.document);

	return {
		name: normalizeOptionalText(data.name),
		email: normalizeOptionalText(data.email)?.toLowerCase() ?? null,
		phone: normalizeOptionalText(data.phone),
		companyName: normalizeRequiredText(data.companyName),
		documentType: document ? (data.documentType ?? null) : null,
		document,
		country: normalizeRequiredText(data.country),
		state: normalizeRequiredText(data.state),
		city: normalizeOptionalText(data.city),
		street: normalizeOptionalText(data.street),
		zipCode: normalizeOptionalText(data.zipCode),
		neighborhood: normalizeOptionalText(data.neighborhood),
		number: normalizeOptionalText(data.number),
		complement: normalizeOptionalText(data.complement),
		status: data.status,
		supervisorIds: data.supervisorIds,
	};
}
