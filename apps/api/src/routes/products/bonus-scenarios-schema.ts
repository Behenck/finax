import z from "zod";

export const BONUS_PERCENTAGE_SCALE = 10_000;

function hasUpTo4DecimalPlaces(value: number) {
	const scaled = Math.round((value + Number.EPSILON) * BONUS_PERCENTAGE_SCALE);
	return Math.abs(scaled / BONUS_PERCENTAGE_SCALE - value) < 1e-10;
}

const BonusPercentageSchema = z
	.number()
	.min(0)
	.max(100)
	.refine(hasUpTo4DecimalPlaces, {
		message: "Percentage must have up to 4 decimal places",
	});

const BonusTotalPercentageSchema = z
	.number()
	.gt(0)
	.max(100)
	.refine(hasUpTo4DecimalPlaces, {
		message: "Total percentage must have up to 4 decimal places",
	});

export const ProductBonusMetricSchema = z.enum(["SALE_TOTAL"]);

export const ProductBonusPeriodFrequencySchema = z.enum([
	"MONTHLY",
	"SEMIANNUAL",
	"ANNUAL",
]);

export const ProductBonusParticipantSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("COMPANY"),
		valueId: z.uuid(),
	}),
	z.object({
		type: z.literal("PARTNER"),
		valueId: z.uuid(),
	}),
	z.object({
		type: z.literal("SELLER"),
		valueId: z.uuid(),
	}),
	z.object({
		type: z.literal("SUPERVISOR"),
		valueId: z.uuid(),
	}),
]);

export const ProductBonusPayoutInstallmentSchema = z.object({
	installmentNumber: z.number().int().min(1),
	percentage: BonusPercentageSchema,
});

export const ProductBonusScenarioSchema = z
	.object({
		name: z.string().trim().min(1),
		metric: ProductBonusMetricSchema.optional(),
		targetAmount: z.number().int().positive(),
		periodFrequency: ProductBonusPeriodFrequencySchema,
		participants: z.array(ProductBonusParticipantSchema).min(1),
		payoutEnabled: z.boolean(),
		payoutTotalPercentage: BonusTotalPercentageSchema.optional(),
		payoutDueDay: z.number().int().min(1).max(31).optional(),
		payoutInstallments: z.array(ProductBonusPayoutInstallmentSchema),
	})
	.superRefine((scenario, ctx) => {
		const participantKeys = new Set<string>();
		for (const [index, participant] of scenario.participants.entries()) {
			const key = `${participant.type}:${participant.valueId}`;
			if (participantKeys.has(key)) {
				ctx.addIssue({
					code: "custom",
					message: "Participant must be unique within the scenario",
					path: ["participants", index],
				});
			}
			participantKeys.add(key);
		}

		if (!scenario.payoutEnabled) {
			if (scenario.payoutTotalPercentage !== undefined) {
				ctx.addIssue({
					code: "custom",
					message: "Payout total percentage is only allowed when payout is enabled",
					path: ["payoutTotalPercentage"],
				});
			}

			if (scenario.payoutDueDay !== undefined) {
				ctx.addIssue({
					code: "custom",
					message: "Payout due day is only allowed when payout is enabled",
					path: ["payoutDueDay"],
				});
			}

			if (scenario.payoutInstallments.length > 0) {
				ctx.addIssue({
					code: "custom",
					message: "Payout installments are only allowed when payout is enabled",
					path: ["payoutInstallments"],
				});
			}

			return;
		}

		if (scenario.payoutTotalPercentage === undefined) {
			ctx.addIssue({
				code: "custom",
				message: "Payout total percentage is required when payout is enabled",
				path: ["payoutTotalPercentage"],
			});
		}

		if (scenario.payoutDueDay === undefined) {
			ctx.addIssue({
				code: "custom",
				message: "Payout due day is required when payout is enabled",
				path: ["payoutDueDay"],
			});
		}

		if (scenario.payoutInstallments.length === 0) {
			ctx.addIssue({
				code: "custom",
				message:
					"Payout installments are required when payout is enabled",
				path: ["payoutInstallments"],
			});
			return;
		}

		const installmentNumbers = new Set<number>();
		for (const [index, installment] of scenario.payoutInstallments.entries()) {
			if (installmentNumbers.has(installment.installmentNumber)) {
				ctx.addIssue({
					code: "custom",
					message: "Installment number must be unique",
					path: ["payoutInstallments", index, "installmentNumber"],
				});
			}
			installmentNumbers.add(installment.installmentNumber);
		}

		if (scenario.payoutTotalPercentage === undefined) {
			return;
		}

		const expectedTotal = toScaledBonusPercentage(scenario.payoutTotalPercentage);
		const installmentsTotal = scenario.payoutInstallments.reduce((sum, installment) => {
			return sum + toScaledBonusPercentage(installment.percentage);
		}, 0);

		if (expectedTotal !== installmentsTotal) {
			ctx.addIssue({
				code: "custom",
				message:
					"Payout installments total percentage must match payout total percentage",
				path: ["payoutInstallments"],
			});
		}
	});

export const ReplaceProductBonusScenariosBodySchema = z.object({
	scenarios: z.array(ProductBonusScenarioSchema),
});

export const GetProductBonusScenariosResponseSchema = z.object({
	scenarios: z.array(ProductBonusScenarioSchema),
});

export type ReplaceProductBonusScenariosBody = z.infer<
	typeof ReplaceProductBonusScenariosBodySchema
>;

export function toScaledBonusPercentage(value: number) {
	return Math.round((value + Number.EPSILON) * BONUS_PERCENTAGE_SCALE);
}

export function fromScaledBonusPercentage(value: number) {
	return value / BONUS_PERCENTAGE_SCALE;
}
