import z from "zod";

export const COMMISSION_PERCENTAGE_SCALE = 10_000;
export const LINKED_COMPANY_CONDITION_ID =
	"00000000-0000-0000-0000-000000000000";
export const LINKED_PARTNER_CONDITION_ID =
	"ffffffff-ffff-ffff-ffff-ffffffffffff";
export const LINKED_UNIT_CONDITION_ID = "11111111-1111-4111-8111-111111111111";
export const LINKED_SELLER_CONDITION_ID =
	"22222222-2222-4222-8222-222222222222";

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
		valueId: z.uuid(),
	}),
	z.object({
		type: z.literal("PARTNER"),
		valueId: z.uuid(),
	}),
	z.object({
		type: z.literal("UNIT"),
		valueId: z.uuid(),
	}),
	z.object({
		type: z.literal("SELLER"),
		valueId: z.uuid(),
	}),
]);

export const CommissionInstallmentSchema = z.object({
	installmentNumber: z.number().int().min(1),
	percentage: PercentageSchema,
});

export const CommissionRecipientTypeSchema = z.enum([
	"COMPANY",
	"UNIT",
	"PARTNER",
	"SELLER",
	"SUPERVISOR",
	"OTHER",
]);

export const ProductCommissionSchema = z
	.object({
		recipientType: CommissionRecipientTypeSchema,
		beneficiaryId: z.uuid().optional(),
		beneficiaryLabel: z.string().trim().optional(),
		totalPercentage: TotalPercentageSchema,
		installments: z.array(CommissionInstallmentSchema).min(1),
	})
	.superRefine((commission, ctx) => {
		if (commission.recipientType === "OTHER") {
			if (!commission.beneficiaryLabel) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Beneficiary label is required for OTHER recipient",
					path: ["beneficiaryLabel"],
				});
			}
		} else if (
			(commission.recipientType === "COMPANY" ||
				commission.recipientType === "UNIT") &&
			!commission.beneficiaryId
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Beneficiary id is required for this recipient type",
				path: ["beneficiaryId"],
			});
		}

		const installmentNumbers = new Set<number>();

		for (const [index, installment] of commission.installments.entries()) {
			if (installmentNumbers.has(installment.installmentNumber)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Installment number must be unique within the commission",
					path: ["installments", index, "installmentNumber"],
				});
			}
			installmentNumbers.add(installment.installmentNumber);
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
				code: z.ZodIssueCode.custom,
				message:
					"Installments total percentage must match commission total percentage",
				path: ["installments"],
			});
		}
	});

export const ProductCommissionScenarioSchema = z.object({
	name: z.string().trim().min(1),
	conditions: z.array(CommissionConditionSchema),
	commissions: z.array(ProductCommissionSchema).min(1),
});

export const ReplaceProductCommissionScenariosBodySchema = z
	.object({
		scenarios: z.array(ProductCommissionScenarioSchema),
	})
	.superRefine((data, ctx) => {
		for (const [index, scenario] of data.scenarios.entries()) {
			if (index > 0 && scenario.conditions.length === 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
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
