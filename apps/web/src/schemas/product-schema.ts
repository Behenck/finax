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

const commissionReversalRuleSchema = z.object({
	installmentNumber: z
		.number({ error: "Informe o número da parcela" })
		.int("Informe o número da parcela")
		.min(1, "Informe um número de parcela válido"),
	percentage: z
		.number({ error: "Informe um percentual válido" })
		.gt(0, "Informe um percentual maior que zero")
		.max(100, "Informe um percentual válido")
		.refine(hasUpTo4Decimals, {
			message: "Use no máximo 4 casas decimais",
		}),
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
		calculationBase: z.enum(["SALE_TOTAL", "COMMISSION"]).optional(),
		baseCommissionIndex: z.number().int().min(0).optional(),
		totalPercentage: totalPercentageSchema,
		installments: z
			.array(commissionInstallmentSchema)
			.min(1, "Informe ao menos uma parcela"),
	})
	.superRefine((commission, ctx) => {
		const calculationBase = commission.calculationBase ?? "SALE_TOTAL";

		if (commission.recipientType === "OTHER") {
			if (!commission.beneficiaryLabel) {
				ctx.addIssue({
					code: "custom",
					message: "Informe quem receberá esta comissão",
					path: ["beneficiaryLabel"],
				});
			}
		} else if (
			commission.recipientType === "UNIT" &&
			!commission.beneficiaryId
		) {
			ctx.addIssue({
				code: "custom",
				message: "Selecione o beneficiário",
				path: ["beneficiaryId"],
			});
		}

		if (
			calculationBase === "COMMISSION" &&
			commission.baseCommissionIndex === undefined
		) {
			ctx.addIssue({
				code: "custom",
				message: "Selecione a comissão base.",
				path: ["baseCommissionIndex"],
			});
		}

		if (
			calculationBase === "SALE_TOTAL" &&
			commission.baseCommissionIndex !== undefined
		) {
			ctx.addIssue({
				code: "custom",
				message:
					"A comissão base só pode ser usada quando o cálculo for por comissão.",
				path: ["baseCommissionIndex"],
			});
		}

		const installmentNumbers = new Set<number>();
		for (const [
			installmentIndex,
			installment,
		] of commission.installments.entries()) {
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
				Math.round(
					(installment.percentage + Number.EPSILON) * PERCENTAGE_SCALE,
				),
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
	isDefault: z.boolean(),
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
			let defaultOptionsCount = 0;
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

				if (option.isDefault) {
					defaultOptionsCount += 1;
				}
			}

			if (field.type === "SELECT" && defaultOptionsCount > 1) {
				ctx.addIssue({
					code: "custom",
					message: "Seleção simples aceita apenas uma opção padrão",
					path: ["options"],
				});
			}
		}
	});

export const productSchema = z
	.object({
		name: z
			.string({ error: "Defina o nome do Produto" })
			.min(1, "Defina o nome do Produto"),
		salesTransactionCategoryId: z.uuid().optional(),
		salesTransactionCostCenterId: z.uuid().optional(),
		scenarios: z.array(productCommissionScenarioSchema),
		saleFields: z.array(productSaleFieldSchema),
		commissionReversalRules: z.array(commissionReversalRuleSchema),
	})
	.superRefine((data, ctx) => {
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

			for (const [
				commissionIndex,
				commission,
			] of scenario.commissions.entries()) {
				const calculationBase = commission.calculationBase ?? "SALE_TOTAL";
				if (calculationBase !== "COMMISSION") {
					continue;
				}

				const baseCommissionIndex = commission.baseCommissionIndex;
				if (
					baseCommissionIndex === undefined ||
					baseCommissionIndex < 0 ||
					baseCommissionIndex >= scenario.commissions.length
				) {
					ctx.addIssue({
						code: "custom",
						message: "Comissão base inválida.",
						path: [
							"scenarios",
							scenarioIndex,
							"commissions",
							commissionIndex,
							"baseCommissionIndex",
						],
					});
					continue;
				}

				if (baseCommissionIndex === commissionIndex) {
					ctx.addIssue({
						code: "custom",
						message: "A comissão não pode usar ela mesma como base.",
						path: [
							"scenarios",
							scenarioIndex,
							"commissions",
							commissionIndex,
							"baseCommissionIndex",
						],
					});
					continue;
				}

				const baseCommission = scenario.commissions[baseCommissionIndex];
				const baseCalculationBase =
					baseCommission?.calculationBase ?? "SALE_TOTAL";
				if (!baseCommission || baseCalculationBase !== "SALE_TOTAL") {
					ctx.addIssue({
						code: "custom",
						message:
							"A comissão base deve ser calculada sobre o valor da venda.",
						path: [
							"scenarios",
							scenarioIndex,
							"commissions",
							commissionIndex,
							"baseCommissionIndex",
						],
					});
				}
			}
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

		const reversalRuleInstallments = new Set<number>();
		for (const [ruleIndex, rule] of data.commissionReversalRules.entries()) {
			if (reversalRuleInstallments.has(rule.installmentNumber)) {
				ctx.addIssue({
					code: "custom",
					message: "Número da parcela repetido",
					path: ["commissionReversalRules", ruleIndex, "installmentNumber"],
				});
			}
			reversalRuleInstallments.add(rule.installmentNumber);
		}
	});

export type ProductFormData = z.infer<typeof productSchema>;
export type ProductFormInput = z.input<typeof productSchema>;
export type ProductCommissionScenarioFormData =
	ProductFormData["scenarios"][number];
export type ProductCommissionFormData =
	ProductCommissionScenarioFormData["commissions"][number];
