import z from "zod";
import { SaleDynamicFieldTypeSchema } from "./types/sale-dynamic-fields";

const PERCENTAGE_SCALE = 10_000;

function hasUpTo4Decimals(value: number) {
	const scaled = Math.round((value + Number.EPSILON) * PERCENTAGE_SCALE);
	return Math.abs(scaled / PERCENTAGE_SCALE - value) < 1e-10;
}

const percentageSchema = z
	.number({ error: "Informe um percentual válido" })
	.min(0, "Informe um percentual válido")
	.max(100, "Informe um percentual válido")
	.refine(hasUpTo4Decimals, {
		message: "Use no máximo 4 casas decimais",
	});

const totalPercentageSchema = z
	.number({ error: "Informe o percentual total" })
	.gt(0, "Informe um percentual maior que zero")
	.max(100, "Informe um percentual válido")
	.refine(hasUpTo4Decimals, {
		message: "Use no máximo 4 casas decimais",
	});

const commissionInstallmentSchema = z.object({
	installmentNumber: z.number().int().min(1),
	percentage: percentageSchema,
});

const productCommissionSchema = z
	.object({
		recipientType: z.enum([
			"COMPANY",
			"UNIT",
			"PARTNER",
			"SELLER",
			"SUPERVISOR",
			"OTHER",
		]),
		beneficiaryId: z.string().uuid().optional(),
		beneficiaryLabel: z.string().trim().optional(),
		totalPercentage: totalPercentageSchema,
		installments: z
			.array(commissionInstallmentSchema)
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
		} else if (
			(commission.recipientType === "COMPANY" ||
				commission.recipientType === "UNIT") &&
			!commission.beneficiaryId
		) {
				ctx.addIssue({
					code: "custom",
					message: "Selecione o beneficiário",
					path: ["beneficiaryId"],
				});
		}

		const installmentNumbers = new Set<number>();
		for (const [installmentIndex, installment] of commission.installments.entries()) {
			if (installmentNumbers.has(installment.installmentNumber)) {
					ctx.addIssue({
						code: "custom",
						message: "Número da parcela repetido",
						path: ["installments", installmentIndex, "installmentNumber"],
					});
			}
			installmentNumbers.add(installment.installmentNumber);
		}

		const totalScaled = Math.round(
			(commission.totalPercentage + Number.EPSILON) * PERCENTAGE_SCALE,
		);
		const installmentsTotalScaled = commission.installments.reduce(
			(sum, installment) =>
				sum +
				Math.round((installment.percentage + Number.EPSILON) * PERCENTAGE_SCALE),
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

const productScenarioConditionSchema = z.object({
	type: z.enum(["COMPANY", "PARTNER", "UNIT", "SELLER"]),
	valueIds: z
		.array(z.union([z.uuid({ error: "Selecione um valor" }), z.null()]))
		.min(1, "Selecione ao menos um valor"),
});

const productCommissionScenarioSchema = z.object({
	name: z
		.string({ error: "Defina um nome para o cenário" })
		.trim()
		.min(1, "Defina um nome para o cenário"),
	conditions: z.array(productScenarioConditionSchema),
	commissions: z
		.array(productCommissionSchema)
		.min(1, "Adicione ao menos uma comissão"),
});

const productSaleFieldOptionSchema = z.object({
	label: z.string().trim().min(1, "Informe o nome da opção"),
});

const productSaleFieldSchema = z
	.object({
		label: z.string().trim().min(1, "Informe o nome do campo"),
		type: SaleDynamicFieldTypeSchema,
		required: z.boolean(),
		options: z.array(productSaleFieldOptionSchema),
	})
	.superRefine((field, ctx) => {
		const isSelectionField =
			field.type === "SELECT" || field.type === "MULTI_SELECT";

		if (isSelectionField && field.options.length === 0) {
			ctx.addIssue({
				code: "custom",
				message: "Campos de seleção precisam ter ao menos uma opção",
				path: ["options"],
			});
		}

		if (isSelectionField) {
			const normalizedOptionLabels = new Set<string>();
			for (const [optionIndex, option] of field.options.entries()) {
				const normalizedOptionLabel = option.label.trim().toLocaleLowerCase();
				if (normalizedOptionLabels.has(normalizedOptionLabel)) {
					ctx.addIssue({
						code: "custom",
						message: "Opções duplicadas não são permitidas",
						path: ["options", optionIndex, "label"],
					});
				}
				normalizedOptionLabels.add(normalizedOptionLabel);
			}
		}
	});

export const productSchema = z.object({
	name: z
		.string({ error: "Defina o nome do Produto" })
		.min(1, "Defina o nome do Produto"),
	scenarios: z.array(productCommissionScenarioSchema),
	saleFields: z.array(productSaleFieldSchema),
}).superRefine((data, ctx) => {
	const scenarioNames = new Set<string>();
	for (const [scenarioIndex, scenario] of data.scenarios.entries()) {
		if (scenarioIndex > 0 && scenario.conditions.length === 0) {
				ctx.addIssue({
					code: "custom",
					message: "Cenários adicionais exigem pelo menos uma condição",
					path: ["scenarios", scenarioIndex, "conditions"],
				});
		}

		const normalizedName = scenario.name.trim().toLowerCase();
		if (scenarioNames.has(normalizedName)) {
				ctx.addIssue({
					code: "custom",
					message: "Nome de cenário duplicado",
					path: ["scenarios", scenarioIndex, "name"],
				});
		}
		scenarioNames.add(normalizedName);
	}

	const saleFieldLabels = new Set<string>();
	for (const [fieldIndex, field] of data.saleFields.entries()) {
		const normalizedFieldLabel = field.label.trim().toLocaleLowerCase();
		if (saleFieldLabels.has(normalizedFieldLabel)) {
			ctx.addIssue({
				code: "custom",
				message: "Nome de campo duplicado",
				path: ["saleFields", fieldIndex, "label"],
			});
		}
		saleFieldLabels.add(normalizedFieldLabel);
	}
});

export type ProductFormData = z.infer<typeof productSchema>;
export type ProductFormInput = z.input<typeof productSchema>;
export type ProductCommissionScenarioFormData = ProductFormData["scenarios"][number];
export type ProductCommissionFormData =
	ProductCommissionScenarioFormData["commissions"][number];
