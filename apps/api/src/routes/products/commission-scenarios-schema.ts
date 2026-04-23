import z from "zod";

export const COMMISSION_PERCENTAGE_SCALE = 10_000;

function hasUpTo4DecimalPlaces(value: number) {
	const scaled = Math.round(
		(value + Number.EPSILON) * COMMISSION_PERCENTAGE_SCALE,
	);
	return Math.abs(scaled / COMMISSION_PERCENTAGE_SCALE - value) < 1e-10;
}

const PercentageSchema = z
	.number()
	.min(0)
	.max(100)
	.refine(hasUpTo4DecimalPlaces, {
		message: "Percentage must have up to 4 decimal places",
	});

const TotalPercentageSchema = z
	.number()
	.gt(0)
	.max(100)
	.refine(hasUpTo4DecimalPlaces, {
		message: "Total percentage must have up to 4 decimal places",
	});

export const CommissionConditionSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("COMPANY"),
		valueId: z.uuid().nullable(),
	}),
	z.object({
		type: z.literal("PARTNER"),
		valueId: z.uuid().nullable(),
	}),
	z.object({
		type: z.literal("UNIT"),
		valueId: z.uuid().nullable(),
	}),
	z.object({
		type: z.literal("SELLER"),
		valueId: z.uuid().nullable(),
	}),
]);

export const CommissionInstallmentInputSchema = z.object({
	installmentNumber: z.number().int().min(1),
	percentage: PercentageSchema,
	monthsToAdvance: z.number().int().min(0).optional(),
});

export const CommissionInstallmentSchema = z.object({
	installmentNumber: z.number().int().min(1),
	percentage: PercentageSchema,
	monthsToAdvance: z.number().int().min(0),
});

export const CommissionRecipientTypeSchema = z.enum([
	"COMPANY",
	"UNIT",
	"PARTNER",
	"SELLER",
	"SUPERVISOR",
	"OTHER",
]);

export const ProductCommissionCalculationBaseSchema = z.enum([
	"SALE_TOTAL",
	"COMMISSION",
]);

export const ProductCommissionInputSchema = z
	.object({
		recipientType: CommissionRecipientTypeSchema,
		beneficiaryId: z.uuid().optional(),
		beneficiaryLabel: z.string().trim().optional(),
		calculationBase: ProductCommissionCalculationBaseSchema.optional(),
		baseCommissionIndex: z.number().int().min(0).optional(),
		useAdvancedDateSchedule: z.boolean().optional(),
		totalPercentage: TotalPercentageSchema,
		dueDay: z.number().int().min(1).max(31).optional(),
		installments: z.array(CommissionInstallmentInputSchema).min(1),
	})
	.superRefine((commission, ctx) => {
		const calculationBase = commission.calculationBase ?? "SALE_TOTAL";

		if (commission.recipientType === "OTHER") {
			if (!commission.beneficiaryLabel) {
				ctx.addIssue({
					code: "custom",
					message: "Beneficiary label is required for OTHER recipient",
					path: ["beneficiaryLabel"],
				});
			}
		} else if (
			commission.recipientType === "UNIT" &&
			!commission.beneficiaryId
		) {
			ctx.addIssue({
				code: "custom",
				message: "Beneficiary id is required for this recipient type",
				path: ["beneficiaryId"],
			});
		}

		if (calculationBase === "COMMISSION" && commission.baseCommissionIndex === undefined) {
			ctx.addIssue({
				code: "custom",
				message:
					"Base commission index is required when calculation base is COMMISSION",
				path: ["baseCommissionIndex"],
			});
		}

		if (calculationBase === "SALE_TOTAL" && commission.baseCommissionIndex !== undefined) {
			ctx.addIssue({
				code: "custom",
				message:
					"Base commission index is only allowed when calculation base is COMMISSION",
				path: ["baseCommissionIndex"],
			});
		}

		const installmentNumbers = new Set<number>();

		for (const [index, installment] of commission.installments.entries()) {
			if (installmentNumbers.has(installment.installmentNumber)) {
				ctx.addIssue({
					code: "custom",
					message: "Installment number must be unique within the commission",
					path: ["installments", index, "installmentNumber"],
				});
			}
			installmentNumbers.add(installment.installmentNumber);

			const useAdvancedDateSchedule =
				commission.useAdvancedDateSchedule ?? false;
			const resolvedMonthsToAdvance =
				index === 0 ? (installment.monthsToAdvance ?? 0) : installment.monthsToAdvance;

			if (useAdvancedDateSchedule && index === 0 && resolvedMonthsToAdvance !== 0) {
				ctx.addIssue({
					code: "custom",
					message: "First installment must use monthsToAdvance = 0",
					path: ["installments", index, "monthsToAdvance"],
				});
			}
		}

		const expectedTotal = toScaledPercentage(commission.totalPercentage);
		const installmentsTotal = commission.installments.reduce(
			(sum, installment) => {
				return sum + toScaledPercentage(installment.percentage);
			},
			0,
		);

		if (expectedTotal !== installmentsTotal) {
			ctx.addIssue({
				code: "custom",
				message:
					"Installments total percentage must match commission total percentage",
				path: ["installments"],
			});
		}
	});

export const ProductCommissionSchema = z.object({
	recipientType: CommissionRecipientTypeSchema,
	beneficiaryId: z.uuid().optional(),
	beneficiaryLabel: z.string().trim().optional(),
	calculationBase: ProductCommissionCalculationBaseSchema.optional(),
	baseCommissionIndex: z.number().int().min(0).optional(),
	useAdvancedDateSchedule: z.boolean(),
	totalPercentage: TotalPercentageSchema,
	dueDay: z.number().int().min(1).max(31).optional(),
	installments: z.array(CommissionInstallmentSchema).min(1),
});

export const ProductCommissionScenarioInputSchema = z.object({
	name: z.string().trim().min(1),
	conditions: z.array(CommissionConditionSchema),
	commissions: z.array(ProductCommissionInputSchema).min(1),
});

export const ProductCommissionScenarioSchema = z.object({
	name: z.string().trim().min(1),
	conditions: z.array(CommissionConditionSchema),
	commissions: z.array(ProductCommissionSchema).min(1),
});

export const ReplaceProductCommissionScenariosBodySchema = z
	.object({
		scenarios: z.array(ProductCommissionScenarioInputSchema),
	})
	.superRefine((data, ctx) => {
		for (const [index, scenario] of data.scenarios.entries()) {
			if (index > 0 && scenario.conditions.length === 0) {
				ctx.addIssue({
					code: "custom",
					message: "Non-default scenarios must have at least one condition",
					path: ["scenarios", index, "conditions"],
				});
			}
		}
	});

export const GetProductCommissionScenariosResponseSchema = z.object({
	scenarios: z.array(ProductCommissionScenarioSchema),
});

export type ReplaceProductCommissionScenariosBody = z.infer<
	typeof ReplaceProductCommissionScenariosBodySchema
>;

export function toScaledPercentage(value: number) {
	return Math.round((value + Number.EPSILON) * COMMISSION_PERCENTAGE_SCALE);
}

export function fromScaledPercentage(value: number) {
	return value / COMMISSION_PERCENTAGE_SCALE;
}
