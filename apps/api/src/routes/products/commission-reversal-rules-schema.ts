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

export const ReplaceProductCommissionReversalRulesBodySchema = z
	.object({
		rules: z.array(ProductCommissionReversalRuleSchema),
	})
	.superRefine((data, ctx) => {
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
	});

export const GetProductCommissionReversalRulesResponseSchema = z.object({
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
