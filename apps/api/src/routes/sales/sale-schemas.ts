import {
	SaleCommissionCalculationBase,
	SaleCommissionDirection,
	SaleCommissionInstallmentStatus,
	SaleCommissionRecipientType,
	SaleCommissionSourceType,
	SaleDynamicFieldType,
	SaleHistoryAction,
	SaleStatus,
} from "generated/prisma/enums";
import z from "zod";

export const saleResponsibleTypeValues = ["SELLER", "PARTNER"] as const;
export const SaleResponsibleTypeSchema = z.enum(saleResponsibleTypeValues);

const saleDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const saleMonthRegex = /^\d{4}-\d{2}$/;

export const SaleDateInputSchema = z
	.string()
	.regex(saleDateRegex)
	.refine(
		(value) => {
			const parsed = new Date(`${value}T00:00:00.000Z`);
			return (
				!Number.isNaN(parsed.getTime()) &&
				parsed.toISOString().slice(0, 10) === value
			);
		},
		{
			message: "Invalid date format. Expected YYYY-MM-DD",
		},
	);

export const SaleMonthInputSchema = z
	.string()
	.regex(saleMonthRegex)
	.refine(
		(value) => {
			const [yearString, monthString] = value.split("-");
			const year = Number(yearString);
			const month = Number(monthString);

			return (
				Number.isInteger(year) &&
				Number.isInteger(month) &&
				month >= 1 &&
				month <= 12
			);
		},
		{
			message: "Invalid month format. Expected YYYY-MM",
		},
	);

export const SaleResponsibleSchema = z
	.object({
		type: SaleResponsibleTypeSchema,
		id: z.uuid(),
	})
	.strict();

export const SaleDynamicFieldTypeSchema = z.enum(SaleDynamicFieldType);

export const SaleDynamicFieldOptionSchema = z.object({
	id: z.uuid(),
	label: z.string(),
});

export const SaleDynamicFieldSchemaItemSchema = z.object({
	fieldId: z.uuid(),
	label: z.string(),
	type: SaleDynamicFieldTypeSchema,
	required: z.boolean(),
	options: z.array(SaleDynamicFieldOptionSchema),
});

export const SaleDynamicFieldValuesSchema = z.record(
	z.string(),
	z.unknown().nullable(),
);

export const SaleDynamicFieldsInputSchema = z.record(z.string(), z.unknown());

export const COMMISSION_PERCENTAGE_SCALE = 10_000;

function hasUpTo4DecimalPlaces(value: number) {
	const scaled = Math.round(
		(value + Number.EPSILON) * COMMISSION_PERCENTAGE_SCALE,
	);
	return Math.abs(scaled / COMMISSION_PERCENTAGE_SCALE - value) < 1e-10;
}

const CommissionPercentageSchema = z
	.number()
	.min(0)
	.max(100)
	.refine(hasUpTo4DecimalPlaces, {
		message: "Percentage must have up to 4 decimal places",
	});

const CommissionTotalPercentageSchema = z
	.number()
	.gt(0)
	.max(100)
	.refine(hasUpTo4DecimalPlaces, {
		message: "Total percentage must have up to 4 decimal places",
	});

export const SaleCommissionSourceTypeSchema = z.enum(SaleCommissionSourceType);
export const SaleCommissionRecipientTypeSchema = z.enum(
	SaleCommissionRecipientType,
);
export const SaleCommissionDirectionSchema = z.enum(SaleCommissionDirection);
export const SaleCommissionCalculationBaseSchema = z.enum(
	SaleCommissionCalculationBase,
);
export const SaleCommissionInstallmentStatusSchema = z.enum(
	SaleCommissionInstallmentStatus,
);

export const SaleCommissionInstallmentInputSchema = z
	.object({
		installmentNumber: z.number().int().min(1),
		percentage: CommissionPercentageSchema,
	})
	.strict();

export const SaleCommissionInputSchema = z
	.object({
		sourceType: SaleCommissionSourceTypeSchema,
		recipientType: SaleCommissionRecipientTypeSchema,
		direction: SaleCommissionDirectionSchema.optional(),
		calculationBase: SaleCommissionCalculationBaseSchema.optional(),
		baseCommissionIndex: z.number().int().min(0).optional(),
		beneficiaryId: z.uuid().optional(),
		beneficiaryLabel: z.string().trim().optional(),
		startDate: SaleDateInputSchema,
		totalPercentage: CommissionTotalPercentageSchema,
		installments: z.array(SaleCommissionInstallmentInputSchema).min(1),
	})
	.strict()
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
		} else if (!commission.beneficiaryId) {
			ctx.addIssue({
				code: "custom",
				message: "Beneficiary id is required for this recipient type",
				path: ["beneficiaryId"],
			});
		}

		if (
			calculationBase === "COMMISSION" &&
			commission.baseCommissionIndex === undefined
		) {
			ctx.addIssue({
				code: "custom",
				message:
					"Base commission index is required when calculation base is COMMISSION",
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

const SaleCommissionInstallmentDetailSchema = z.object({
	installmentNumber: z.number().int().min(1),
	percentage: CommissionPercentageSchema,
	amount: z.number().int().nonnegative(),
	status: SaleCommissionInstallmentStatusSchema,
	expectedPaymentDate: z.date(),
	paymentDate: z.date().nullable(),
});

export const SaleCommissionDetailSchema = z.object({
	id: z.uuid(),
	sourceType: SaleCommissionSourceTypeSchema,
	recipientType: SaleCommissionRecipientTypeSchema,
	direction: SaleCommissionDirectionSchema,
	calculationBase: SaleCommissionCalculationBaseSchema,
	baseCommissionIndex: z.number().int().min(0).optional(),
	beneficiaryId: z.uuid().nullable(),
	beneficiaryLabel: z.string().nullable(),
	startDate: z.date(),
	totalPercentage: CommissionTotalPercentageSchema,
	totalAmount: z.number().int().nonnegative(),
	sortOrder: z.number().int().nonnegative(),
	installments: z.array(SaleCommissionInstallmentDetailSchema).min(1),
});

export const SaleCommissionInstallmentsSummarySchema = z.object({
	total: z.number().int().nonnegative(),
	pending: z.number().int().nonnegative(),
	paid: z.number().int().nonnegative(),
	canceled: z.number().int().nonnegative(),
});

export const SaleCommissionInstallmentRowSchema = z.object({
	id: z.uuid(),
	saleCommissionId: z.uuid(),
	recipientType: SaleCommissionRecipientTypeSchema,
	sourceType: SaleCommissionSourceTypeSchema,
	direction: SaleCommissionDirectionSchema,
	beneficiaryId: z.uuid().nullable(),
	beneficiaryKey: z.string().min(1),
	beneficiaryLabel: z.string().nullable(),
	installmentNumber: z.number().int().min(1),
	percentage: CommissionPercentageSchema,
	amount: z.number().int().nonnegative(),
	status: SaleCommissionInstallmentStatusSchema,
	expectedPaymentDate: z.date(),
	paymentDate: z.date().nullable(),
});

const saleCommissionInstallmentStatusFilterValues = [
	"ALL",
	"PENDING",
	"PAID",
	"CANCELED",
] as const;

export const SaleCommissionInstallmentStatusFilterSchema = z.enum(
	saleCommissionInstallmentStatusFilterValues,
);

export const GetOrganizationCommissionInstallmentsQuerySchema = z
	.object({
		page: z.coerce.number().int().min(1).default(1),
		pageSize: z.coerce.number().int().min(1).max(100).default(20),
		q: z.string().trim().default(""),
		productId: z.uuid().optional(),
		direction: SaleCommissionDirectionSchema.optional(),
		status: SaleCommissionInstallmentStatusFilterSchema.default("ALL"),
		expectedFrom: SaleDateInputSchema.optional(),
		expectedTo: SaleDateInputSchema.optional(),
	})
	.strict();

const SaleContextEntitySchema = z.object({
	id: z.uuid(),
	name: z.string(),
});

export const OrganizationCommissionInstallmentRowSchema = z.object({
	id: z.uuid(),
	saleId: z.uuid(),
	saleStatus: z.enum(SaleStatus),
	saleDate: z.date(),
	customer: SaleContextEntitySchema,
	product: SaleContextEntitySchema,
	company: SaleContextEntitySchema,
	unit: SaleContextEntitySchema.nullable(),
	saleCommissionId: z.uuid(),
	installmentNumber: z.number().int().min(1),
	recipientType: SaleCommissionRecipientTypeSchema,
	sourceType: SaleCommissionSourceTypeSchema,
	direction: SaleCommissionDirectionSchema,
	beneficiaryId: z.uuid().nullable(),
	beneficiaryLabel: z.string().nullable(),
	beneficiaryKey: z.string().min(1),
	percentage: CommissionPercentageSchema,
	amount: z.number().int().nonnegative(),
	status: SaleCommissionInstallmentStatusSchema,
	expectedPaymentDate: z.date(),
	paymentDate: z.date().nullable(),
});

export const CommissionInstallmentSummaryBucketSchema = z.object({
	count: z.number().int().nonnegative(),
	amount: z.number().int().nonnegative(),
});

export const CommissionInstallmentDirectionSummarySchema = z.object({
	total: CommissionInstallmentSummaryBucketSchema,
	pending: CommissionInstallmentSummaryBucketSchema,
	paid: CommissionInstallmentSummaryBucketSchema,
	canceled: CommissionInstallmentSummaryBucketSchema,
});

export const OrganizationCommissionInstallmentsResponseSchema = z.object({
	items: z.array(OrganizationCommissionInstallmentRowSchema),
	pagination: z.object({
		page: z.number().int().min(1),
		pageSize: z.number().int().min(1).max(100),
		total: z.number().int().nonnegative(),
		totalPages: z.number().int().min(1),
	}),
	summaryByDirection: z.object({
		INCOME: CommissionInstallmentDirectionSummarySchema,
		OUTCOME: CommissionInstallmentDirectionSummarySchema,
	}),
});

export const GetSalesDashboardQuerySchema = z
	.object({
		month: SaleMonthInputSchema,
	})
	.strict();

const SalesDashboardPeriodRangeSchema = z.object({
	month: SaleMonthInputSchema,
	from: z.date(),
	to: z.date(),
});

const SalesDashboardSalesSummarySchema = z.object({
	count: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
	averageTicket: z.number().int().nonnegative(),
});

const SalesDashboardTimelineItemSchema = z.object({
	date: z.date(),
	count: z.number().int().nonnegative(),
	amount: z.number().int().nonnegative(),
});

const SalesDashboardTopProductSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	count: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
});

const SalesDashboardTopResponsibleSchema = z.object({
	id: z.uuid(),
	type: SaleResponsibleTypeSchema,
	name: z.string(),
	count: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
});

const SalesDashboardCommissionsPeriodSchema = z.object({
	INCOME: CommissionInstallmentDirectionSummarySchema,
	OUTCOME: CommissionInstallmentDirectionSummarySchema,
	netAmount: z.number().int(),
});

export const SalesDashboardResponseSchema = z.object({
	period: z.object({
		selectedMonth: SaleMonthInputSchema,
		current: SalesDashboardPeriodRangeSchema,
		previous: SalesDashboardPeriodRangeSchema,
	}),
	sales: z.object({
		current: SalesDashboardSalesSummarySchema,
		previous: SalesDashboardSalesSummarySchema,
		byStatus: z.object({
			PENDING: CommissionInstallmentSummaryBucketSchema,
			APPROVED: CommissionInstallmentSummaryBucketSchema,
			COMPLETED: CommissionInstallmentSummaryBucketSchema,
			CANCELED: CommissionInstallmentSummaryBucketSchema,
		}),
		timeline: z.array(SalesDashboardTimelineItemSchema),
		topProducts: z.array(SalesDashboardTopProductSchema),
		topResponsibles: z.array(SalesDashboardTopResponsibleSchema),
	}),
	commissions: z.object({
		reference: z.literal("EXPECTED_PAYMENT_DATE"),
		current: SalesDashboardCommissionsPeriodSchema,
		previous: SalesDashboardCommissionsPeriodSchema,
	}),
});

export const CreateSaleBodySchema = z
	.object({
		saleDate: SaleDateInputSchema,
		customerId: z.uuid(),
		productId: z.uuid(),
		totalAmount: z.number().int().positive(),
		responsible: SaleResponsibleSchema,
		companyId: z.uuid(),
		unitId: z.uuid().optional(),
		notes: z.string().optional(),
		dynamicFields: SaleDynamicFieldsInputSchema.optional(),
		commissions: z.array(SaleCommissionInputSchema).optional(),
	})
	.strict()
	.superRefine((data, ctx) => {
		if (!data.commissions) {
			return;
		}

		for (const [commissionIndex, commission] of data.commissions.entries()) {
			const calculationBase = commission.calculationBase ?? "SALE_TOTAL";
			if (calculationBase !== "COMMISSION") {
				continue;
			}

			const baseCommissionIndex = commission.baseCommissionIndex;
			if (
				baseCommissionIndex === undefined ||
				baseCommissionIndex < 0 ||
				baseCommissionIndex >= data.commissions.length
			) {
				ctx.addIssue({
					code: "custom",
					message: "Invalid base commission reference",
					path: ["commissions", commissionIndex, "baseCommissionIndex"],
				});
				continue;
			}

			if (baseCommissionIndex === commissionIndex) {
				ctx.addIssue({
					code: "custom",
					message: "A commission cannot reference itself as calculation base",
					path: ["commissions", commissionIndex, "baseCommissionIndex"],
				});
				continue;
			}

			const baseCommission = data.commissions[baseCommissionIndex];
			const baseCalculationBase = baseCommission?.calculationBase ?? "SALE_TOTAL";
			if (!baseCommission || baseCalculationBase !== "SALE_TOTAL") {
				ctx.addIssue({
					code: "custom",
					message:
						"Commission base must reference a SALE_TOTAL commission",
					path: ["commissions", commissionIndex, "baseCommissionIndex"],
				});
			}
		}
	});

export const UpdateSaleBodySchema = CreateSaleBodySchema;

export const PatchSaleStatusBodySchema = z
	.object({
		status: z.enum(SaleStatus),
	})
	.strict();

export const PatchSalesStatusBulkBodySchema = z
	.object({
		saleIds: z.array(z.uuid()).min(1).max(100),
		status: z.enum(SaleStatus),
	})
	.strict();

export const PatchSalesStatusBulkResponseSchema = z.object({
	updated: z.number().int().nonnegative(),
});

export const PatchSalesDeleteBulkBodySchema = z
	.object({
		saleIds: z.array(z.uuid()).min(1).max(100),
	})
	.strict();

export const PatchSalesDeleteBulkResponseSchema = z.object({
	deleted: z.number().int().nonnegative(),
});

export const PatchSaleCommissionInstallmentStatusBodySchema = z
	.object({
		status: z.enum([
			SaleCommissionInstallmentStatus.PAID,
			SaleCommissionInstallmentStatus.CANCELED,
		] as const),
		paymentDate: SaleDateInputSchema.optional(),
		amount: z.number().int().nonnegative().optional(),
	})
	.strict();

export const PatchSaleCommissionInstallmentBodySchema = z
	.object({
		percentage: CommissionPercentageSchema.optional(),
		amount: z.number().int().nonnegative().optional(),
		status: SaleCommissionInstallmentStatusSchema.optional(),
		expectedPaymentDate: SaleDateInputSchema.optional(),
		paymentDate: SaleDateInputSchema.nullable().optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one field must be provided",
	});

const NamedEntitySchema = z.object({
	id: z.uuid(),
	name: z.string(),
});

export const SaleResponsiblePayloadSchema = z.object({
	type: SaleResponsibleTypeSchema,
	id: z.uuid(),
	name: z.string(),
});

const SaleBaseResponseSchema = z.object({
	id: z.uuid(),
	saleDate: z.date(),
	totalAmount: z.number().int(),
	status: z.enum(SaleStatus),
	notes: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
	customer: NamedEntitySchema,
	product: NamedEntitySchema,
	company: NamedEntitySchema,
	unit: NamedEntitySchema.nullable(),
	createdBy: z.object({
		id: z.uuid(),
		name: z.string().nullable(),
		avatarUrl: z.string().nullable(),
	}),
	responsible: SaleResponsiblePayloadSchema.nullable(),
});

export const SaleSummarySchema = SaleBaseResponseSchema.extend({
	commissionInstallmentsSummary: SaleCommissionInstallmentsSummarySchema,
});

export const SaleDetailSchema = SaleBaseResponseSchema.extend({
	organizationId: z.uuid(),
	companyId: z.uuid(),
	unitId: z.uuid().nullable(),
	customerId: z.uuid(),
	productId: z.uuid(),
	responsibleType: SaleResponsibleTypeSchema.nullable(),
	responsibleId: z.uuid().nullable(),
	createdById: z.uuid(),
	dynamicFieldSchema: z.array(SaleDynamicFieldSchemaItemSchema),
	dynamicFieldValues: SaleDynamicFieldValuesSchema,
	commissions: z.array(SaleCommissionDetailSchema),
});

export const SaleHistoryActionSchema = z.enum(SaleHistoryAction);

export const SaleHistoryChangeSchema = z.object({
	path: z.string(),
	before: z.unknown().nullable(),
	after: z.unknown().nullable(),
});

export const SaleHistoryEventSchema = z.object({
	id: z.uuid(),
	action: SaleHistoryActionSchema,
	createdAt: z.date(),
	actor: z.object({
		id: z.uuid(),
		name: z.string().nullable(),
		avatarUrl: z.string().nullable(),
	}),
	changes: z.array(SaleHistoryChangeSchema),
});

export type SaleResponsibleInput = z.infer<typeof SaleResponsibleSchema>;
export type SaleCommissionInput = z.infer<typeof SaleCommissionInputSchema>;
export type SaleCommissionInstallmentInput = z.infer<
	typeof SaleCommissionInstallmentInputSchema
>;
export type SaleCommissionInstallmentRow = z.infer<
	typeof SaleCommissionInstallmentRowSchema
>;
export type SaleCommissionInstallmentStatusFilter = z.infer<
	typeof SaleCommissionInstallmentStatusFilterSchema
>;
export type GetOrganizationCommissionInstallmentsQuery = z.infer<
	typeof GetOrganizationCommissionInstallmentsQuerySchema
>;
export type GetSalesDashboardQuery = z.infer<
	typeof GetSalesDashboardQuerySchema
>;
export type CreateSaleBody = z.infer<typeof CreateSaleBodySchema>;
export type UpdateSaleBody = z.infer<typeof UpdateSaleBodySchema>;
export type SaleDynamicFieldSchemaItem = z.infer<
	typeof SaleDynamicFieldSchemaItemSchema
>;
export type SaleDynamicFieldValues = z.infer<
	typeof SaleDynamicFieldValuesSchema
>;
export type PatchSaleStatusBody = z.infer<typeof PatchSaleStatusBodySchema>;
export type PatchSalesStatusBulkBody = z.infer<
	typeof PatchSalesStatusBulkBodySchema
>;
export type PatchSaleCommissionInstallmentStatusBody = z.infer<
	typeof PatchSaleCommissionInstallmentStatusBodySchema
>;
export type PatchSaleCommissionInstallmentBody = z.infer<
	typeof PatchSaleCommissionInstallmentBodySchema
>;
export type SaleHistoryChange = z.infer<typeof SaleHistoryChangeSchema>;
export type SaleHistoryEvent = z.infer<typeof SaleHistoryEventSchema>;

export function parseSaleDateInput(value: string) {
	return new Date(`${value}T00:00:00.000Z`);
}

export function toScaledPercentage(value: number) {
	return Math.round((value + Number.EPSILON) * COMMISSION_PERCENTAGE_SCALE);
}

export function fromScaledPercentage(value: number) {
	return value / COMMISSION_PERCENTAGE_SCALE;
}
