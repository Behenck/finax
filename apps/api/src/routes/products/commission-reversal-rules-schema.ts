import z from "zod";

const PERCENTAGE_SCALE = 10_000;

function hasUpTo4DecimalPlaces(value: number) {
	const scaled = Math.round((value + Number.EPSILON) * PERCENTAGE_SCALE);
	return Math.abs(scaled / PERCENTAGE_SCALE - value) < 1e-10;
}

const ReversalPercentageSchema = z
	.number()
	.gt(0)
	.max(100)
	.refine(hasUpTo4DecimalPlaces, {
		message: "Percentage must have up to 4 decimal places",
	});

export const ProductCommissionReversalRuleSchema = z.object({
	installmentNumber: z.number().int().min(1),
	percentage: ReversalPercentageSchema,
});

export const ProductCommissionReversalModeSchema = z.enum([
	"INSTALLMENT_BY_NUMBER",
	"TOTAL_PAID_PERCENTAGE",
]);

export const ReplaceProductCommissionReversalRulesBodySchema = z
	.object({
		mode: ProductCommissionReversalModeSchema.nullable().optional(),
		totalPaidPercentage: ReversalPercentageSchema.nullable().optional(),
		rules: z.array(ProductCommissionReversalRuleSchema).default([]),
	})
	.superRefine((data, ctx) => {
		const mode = data.mode ?? null;
		const installmentNumbers = new Set<number>();

		for (const [index, rule] of data.rules.entries()) {
			if (installmentNumbers.has(rule.installmentNumber)) {
				ctx.addIssue({
					code: "custom",
					message:
						"Installment number must be unique within reversal rules",
					path: ["rules", index, "installmentNumber"],
				});
			}
			installmentNumbers.add(rule.installmentNumber);
		}

		if (mode === "INSTALLMENT_BY_NUMBER") {
			if (data.totalPaidPercentage !== undefined && data.totalPaidPercentage !== null) {
				ctx.addIssue({
					code: "custom",
					message:
						"totalPaidPercentage must be omitted for INSTALLMENT_BY_NUMBER mode",
					path: ["totalPaidPercentage"],
				});
			}
		}

		if (mode === "TOTAL_PAID_PERCENTAGE") {
			if (
				data.totalPaidPercentage === undefined ||
				data.totalPaidPercentage === null
			) {
				ctx.addIssue({
					code: "custom",
					message:
						"totalPaidPercentage is required for TOTAL_PAID_PERCENTAGE mode",
					path: ["totalPaidPercentage"],
				});
			}

			if (data.rules.length > 0) {
				ctx.addIssue({
					code: "custom",
					message:
						"rules must be empty for TOTAL_PAID_PERCENTAGE mode",
					path: ["rules"],
				});
			}
		}

		if (mode === null) {
			if (data.rules.length > 0) {
				ctx.addIssue({
					code: "custom",
					message:
						"rules must be empty when reversal mode is not configured",
					path: ["rules"],
				});
			}

			if (data.totalPaidPercentage !== undefined && data.totalPaidPercentage !== null) {
				ctx.addIssue({
					code: "custom",
					message:
						"totalPaidPercentage must be omitted when reversal mode is not configured",
					path: ["totalPaidPercentage"],
				});
			}
		}
	});

export const GetProductCommissionReversalRulesResponseSchema = z.object({
	mode: ProductCommissionReversalModeSchema.nullable(),
	totalPaidPercentage: ReversalPercentageSchema.nullable(),
	rules: z.array(ProductCommissionReversalRuleSchema),
});

export type ReplaceProductCommissionReversalRulesBody = z.infer<
	typeof ReplaceProductCommissionReversalRulesBodySchema
>;

export function toScaledReversalPercentage(value: number) {
	return Math.round((value + Number.EPSILON) * PERCENTAGE_SCALE);
}

export function fromScaledReversalPercentage(value: number) {
	return value / PERCENTAGE_SCALE;
}
