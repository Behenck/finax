import { z } from "zod";
import { parseBRLCurrencyToCents } from "@/utils/format-amount";
import {
	SaleCommissionRecipientTypeSchema,
	SaleCommissionSourceTypeSchema,
	SaleResponsibleTypeSchema,
} from "./types/sales";

const COMMISSION_PERCENTAGE_SCALE = 10_000;

function hasUpTo4Decimals(value: number) {
	const scaled = Math.round(
		(value + Number.EPSILON) * COMMISSION_PERCENTAGE_SCALE,
	);
	return Math.abs(scaled / COMMISSION_PERCENTAGE_SCALE - value) < 1e-10;
}

function toScaledPercentage(value: number) {
	return Math.round((value + Number.EPSILON) * COMMISSION_PERCENTAGE_SCALE);
}

const commissionPercentageSchema = z
	.number({ error: "Informe um percentual válido" })
	.min(0, "Informe um percentual válido")
	.max(100, "Informe um percentual válido")
	.refine(hasUpTo4Decimals, {
		message: "Use no máximo 4 casas decimais",
	});

const commissionTotalPercentageSchema = z
	.number({ error: "Informe o percentual total" })
	.gt(0, "Informe um percentual maior que zero")
	.max(100, "Informe um percentual válido")
	.refine(hasUpTo4Decimals, {
		message: "Use no máximo 4 casas decimais",
	});

const saleCommissionInstallmentSchema = z.object({
	installmentNumber: z.number().int().min(1),
	percentage: commissionPercentageSchema,
});

export const saleCommissionSchema = z
	.object({
		sourceType: SaleCommissionSourceTypeSchema,
		recipientType: SaleCommissionRecipientTypeSchema,
		beneficiaryId: z.string().uuid().optional(),
		beneficiaryLabel: z.string().trim().optional(),
		startDate: z.coerce.date({
			error: "Selecione a data de início da comissão",
		}),
		totalPercentage: commissionTotalPercentageSchema,
		installments: z
			.array(saleCommissionInstallmentSchema)
			.min(1, "Informe ao menos uma parcela"),
	})
	.superRefine((commission, ctx) => {
		if (commission.recipientType === "OTHER") {
			if (!commission.beneficiaryLabel) {
				ctx.addIssue({
					code: "custom",
					message: "Informe quem receberá esta comissão",
					path: ["beneficiaryLabel"],
				});
			}
		} else if (!commission.beneficiaryId) {
			ctx.addIssue({
				code: "custom",
				message: "Selecione o beneficiário",
				path: ["beneficiaryId"],
			});
		}

		const installmentNumbers = new Set<number>();
		for (const [index, installment] of commission.installments.entries()) {
			if (installmentNumbers.has(installment.installmentNumber)) {
				ctx.addIssue({
					code: "custom",
					message: "Número da parcela repetido",
					path: ["installments", index, "installmentNumber"],
				});
			}
			installmentNumbers.add(installment.installmentNumber);
		}

		const totalScaled = toScaledPercentage(commission.totalPercentage);
		const installmentsTotalScaled = commission.installments.reduce(
			(sum, installment) => sum + toScaledPercentage(installment.percentage),
			0,
		);

		if (totalScaled !== installmentsTotalScaled) {
			ctx.addIssue({
				code: "custom",
				message: "A soma das parcelas deve ser igual ao % total",
				path: ["installments"],
			});
		}
	});

export const saleSchema = z.object({
	saleDate: z.coerce.date({ error: "Selecione a data da venda" }),
	customerId: z.uuid({ error: "Selecione o cliente" }),
	productId: z.uuid({ error: "Selecione o produto" }),
	companyId: z.uuid({ error: "Selecione a empresa" }),
	unitId: z.preprocess(
		(value) => (value === "" ? undefined : value),
		z.uuid().optional(),
	),
	responsibleType: SaleResponsibleTypeSchema,
	responsibleId: z.uuid({ error: "Selecione o responsável" }),
	totalAmount: z
		.string({ error: "Defina um valor" })
		.min(1)
		.refine((value) => parseBRLCurrencyToCents(value) > 0, {
			message: "Defina um valor válido",
		}),
	notes: z
		.string()
		.max(500, "A observação deve ter no máximo 500 caracteres")
		.optional(),
	commissions: z.array(saleCommissionSchema).optional(),
});

export type SaleFormInput = z.input<typeof saleSchema>;
export type SaleFormData = z.output<typeof saleSchema>;
export type SaleCommissionFormData = z.infer<typeof saleCommissionSchema>;
