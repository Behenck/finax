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
import { format } from "date-fns";
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
	amount: z.number().int(),
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
	totalAmount: z.number().int(),
	sortOrder: z.number().int().nonnegative(),
	installments: z.array(SaleCommissionInstallmentDetailSchema).min(1),
});

export const SaleCommissionInstallmentsSummarySchema = z.object({
	total: z.number().int().nonnegative(),
	pending: z.number().int().nonnegative(),
	paid: z.number().int().nonnegative(),
	canceled: z.number().int().nonnegative(),
	reversed: z.number().int().nonnegative(),
});

export const SaleCommissionInstallmentRowSchema = z.object({
	id: z.uuid(),
	saleCommissionId: z.uuid(),
	originInstallmentId: z.uuid().nullable(),
	originInstallmentNumber: z.number().int().min(1).nullable(),
	recipientType: SaleCommissionRecipientTypeSchema,
	sourceType: SaleCommissionSourceTypeSchema,
	direction: SaleCommissionDirectionSchema,
	beneficiaryId: z.uuid().nullable(),
	beneficiaryKey: z.string().min(1),
	beneficiaryLabel: z.string().nullable(),
	installmentNumber: z.number().int().min(1),
	percentage: CommissionPercentageSchema,
	amount: z.number().int(),
	status: SaleCommissionInstallmentStatusSchema,
	expectedPaymentDate: z.date(),
	paymentDate: z.date().nullable(),
});

const saleCommissionInstallmentStatusFilterValues = [
	"ALL",
	"PENDING",
	"PAID",
	"CANCELED",
	"REVERSED",
] as const;

export const SaleCommissionInstallmentStatusFilterSchema = z.enum(
	saleCommissionInstallmentStatusFilterValues,
);

export const GetOrganizationCommissionInstallmentsQuerySchema = z
	.object({
		page: z.coerce.number().int().min(1).default(1),
		pageSize: z.coerce.number().int().min(1).max(100).default(20),
		q: z.string().trim().default(""),
		companyId: z.uuid().optional(),
		unitId: z.uuid().optional(),
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
	originInstallmentId: z.uuid().nullable(),
	originInstallmentNumber: z.number().int().min(1).nullable(),
	installmentNumber: z.number().int().min(1),
	recipientType: SaleCommissionRecipientTypeSchema,
	sourceType: SaleCommissionSourceTypeSchema,
	direction: SaleCommissionDirectionSchema,
	beneficiaryId: z.uuid().nullable(),
	beneficiaryLabel: z.string().nullable(),
	beneficiaryKey: z.string().min(1),
	percentage: CommissionPercentageSchema,
	amount: z.number().int(),
	status: SaleCommissionInstallmentStatusSchema,
	expectedPaymentDate: z.date(),
	paymentDate: z.date().nullable(),
});

export const CommissionInstallmentSummaryBucketSchema = z.object({
	count: z.number().int().nonnegative(),
	amount: z.number().int(),
});

export const CommissionInstallmentDirectionSummarySchema = z.object({
	total: CommissionInstallmentSummaryBucketSchema,
	pending: CommissionInstallmentSummaryBucketSchema,
	paid: CommissionInstallmentSummaryBucketSchema,
	canceled: CommissionInstallmentSummaryBucketSchema,
	reversed: CommissionInstallmentSummaryBucketSchema,
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

const PartnerSalesDashboardPartnerIdsQuerySchema = z
	.union([z.string(), z.array(z.string())])
	.optional()
	.transform((value) => {
		if (!value) {
			return undefined;
		}

		const values = Array.isArray(value) ? value : [value];
		const normalizedValues = values
			.flatMap((item) => item.split(","))
			.map((item) => item.trim())
			.filter(Boolean);

		return normalizedValues.length > 0 ? normalizedValues : undefined;
	})
	.pipe(z.array(z.uuid()).optional());

export const GetPartnerSalesDashboardQuerySchema = z
	.object({
		startDate: SaleDateInputSchema,
		endDate: SaleDateInputSchema,
		inactiveMonths: z.coerce.number().int().min(1).max(24).default(3),
		supervisorId: z.uuid().optional(),
		partnerIds: PartnerSalesDashboardPartnerIdsQuerySchema,
		dynamicFieldId: z.uuid().optional(),
		productBreakdownDepth: z
			.enum(["FIRST_LEVEL", "ALL_LEVELS"] as const)
			.default("FIRST_LEVEL"),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (value.startDate > value.endDate) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["endDate"],
				message: "endDate must be greater than or equal to startDate",
			});
		}
	});

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

const PartnerSalesDashboardDateRangeSchema = z.object({
	from: z.date(),
	to: z.date(),
});

const PartnerSalesDashboardSummarySchema = z.object({
	totalPartners: z.number().int().nonnegative(),
	activePartners: z.number().int().nonnegative(),
	inactivePartners: z.number().int().nonnegative(),
	producingPartners: z.number().int().nonnegative(),
	producingPartnersRatePct: z.number().min(0).max(100),
	partnersWithoutProduction: z.number().int().nonnegative(),
	totalSales: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
	averageTicket: z.number().int().nonnegative(),
	averageTicketPerProducingPartner: z.number().int().nonnegative(),
	commissionReceivedAmount: z.number().int().nonnegative(),
	commissionPendingAmount: z.number().int().nonnegative(),
	netRevenueAmount: z.number().int(),
	delinquentSalesCount: z.number().int().nonnegative(),
	delinquentGrossAmount: z.number().int().nonnegative(),
	delinquencyRateByCountPct: z.number().min(0).max(100),
	delinquencyRateByAmountPct: z.number().min(0).max(100),
});

const PartnerSalesDashboardSupervisorSummarySchema = z.object({
	id: z.uuid(),
	name: z.string().nullable(),
});

const PartnerSalesDashboardPartnerFilterItemSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	status: z.enum(["ACTIVE", "INACTIVE"] as const),
	supervisorId: z.uuid().nullable(),
	supervisorName: z.string().nullable(),
});

const PartnerSalesDashboardTimelineGranularitySchema = z.enum([
	"DAY",
	"MONTH",
] as const);

const PartnerSalesDashboardTimelineItemSchema = z.object({
	label: z.string(),
	date: z.date(),
	salesCount: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
	concludedGrossAmount: z.number().int().nonnegative(),
	processedGrossAmount: z.number().int().nonnegative(),
	concludedAndProcessedGrossAmount: z.number().int().nonnegative(),
	canceledGrossAmount: z.number().int().nonnegative(),
});

const PartnerSalesDashboardRankingSalesBreakdownBucketSchema = z.object({
	salesCount: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
});

const PartnerSalesDashboardRankingItemSchema = z.object({
	partnerId: z.uuid(),
	partnerName: z.string(),
	status: z.enum(["ACTIVE", "INACTIVE"] as const),
	supervisor: PartnerSalesDashboardSupervisorSummarySchema.nullable(),
	salesCount: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
	averageTicket: z.number().int().nonnegative(),
	commissionReceivedAmount: z.number().int().nonnegative(),
	netRevenueAmount: z.number().int(),
	delinquentSalesCount: z.number().int().nonnegative(),
	delinquentGrossAmount: z.number().int().nonnegative(),
	delinquencyRateByCountPct: z.number().min(0).max(100),
	delinquencyRateByAmountPct: z.number().min(0).max(100),
	lastSaleDate: z.date().nullable(),
	salesBreakdown: z.object({
		concluded: PartnerSalesDashboardRankingSalesBreakdownBucketSchema,
		pending: PartnerSalesDashboardRankingSalesBreakdownBucketSchema,
		canceled: PartnerSalesDashboardRankingSalesBreakdownBucketSchema,
	}),
});

const PartnerSalesDashboardDynamicFieldTypeSchema = z.enum([
	"SELECT",
	"MULTI_SELECT",
] as const);

const PartnerSalesDashboardDynamicFieldSchema = z.object({
	fieldId: z.uuid(),
	label: z.string(),
	type: PartnerSalesDashboardDynamicFieldTypeSchema,
});

const PartnerSalesDashboardDynamicFieldBreakdownItemSchema = z.object({
	valueId: z.string(),
	label: z.string(),
	salesCount: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
});

const PartnerSalesDashboardProductBreakdownItemSchema = z.object({
	valueId: z.string(),
	label: z.string(),
	salesCount: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
});

const PartnerSalesDashboardStatusFunnelStatusSchema = z.enum([
	"PENDING",
	"APPROVED",
	"COMPLETED",
	"CANCELED",
] as const);

const PartnerSalesDashboardStatusFunnelItemSchema = z.object({
	status: PartnerSalesDashboardStatusFunnelStatusSchema,
	label: z.string(),
	salesCount: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
});

const PartnerSalesDashboardParetoItemSchema = z.object({
	partnerId: z.uuid(),
	partnerName: z.string(),
	salesCount: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
	cumulativeGrossAmount: z.number().int().nonnegative(),
	cumulativeGrossPct: z.number().min(0).max(100),
	cumulativeSalesPct: z.number().min(0).max(100),
});

const PartnerSalesDashboardTicketByPartnerItemSchema = z.object({
	partnerId: z.uuid(),
	partnerName: z.string(),
	salesCount: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
	averageTicket: z.number().int().nonnegative(),
});

const PartnerSalesDashboardProductionHealthTimelineItemSchema = z.object({
	date: z.date(),
	label: z.string(),
	producingPartners: z.number().int().nonnegative(),
	totalPartners: z.number().int().nonnegative(),
	producingRatePct: z.number().min(0).max(100),
});

const PartnerSalesDashboardCommissionPendingByPartnerItemSchema = z.object({
	partnerId: z.uuid(),
	partnerName: z.string(),
	status: z.enum(["ACTIVE", "INACTIVE"] as const),
	supervisor: PartnerSalesDashboardSupervisorSummarySchema.nullable(),
	salesCount: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
	pendingAmount: z.number().int().nonnegative(),
	lastSaleDate: z.date().nullable(),
});

const PartnerSalesDashboardRecencyBucketKeySchema = z.enum([
	"RANGE_0_30",
	"RANGE_31_60",
	"RANGE_61_90",
	"RANGE_90_PLUS",
	"NO_SALES",
] as const);

const PartnerSalesDashboardRecencyBucketSchema = z.object({
	key: PartnerSalesDashboardRecencyBucketKeySchema,
	label: z.string(),
	partnersCount: z.number().int().nonnegative(),
});

const PartnerSalesDashboardRiskRankingItemSchema = z.object({
	partnerId: z.uuid(),
	partnerName: z.string(),
	status: z.enum(["ACTIVE", "INACTIVE"] as const),
	supervisor: PartnerSalesDashboardSupervisorSummarySchema.nullable(),
	totalSales: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
	delinquentSalesCount: z.number().int().nonnegative(),
	delinquentGrossAmount: z.number().int().nonnegative(),
	delinquencyRateByCountPct: z.number().min(0).max(100),
	delinquencyRateByAmountPct: z.number().min(0).max(100),
	lastSaleDate: z.date().nullable(),
});

const PartnerSalesDashboardDelinquencyBucketKeySchema = z.enum([
	"RANGE_1_30",
	"RANGE_31_60",
	"RANGE_61_90",
	"RANGE_90_PLUS",
] as const);

const PartnerSalesDashboardDelinquencyBucketSchema = z.object({
	key: PartnerSalesDashboardDelinquencyBucketKeySchema,
	label: z.string(),
	salesCount: z.number().int().nonnegative(),
	grossAmount: z.number().int().nonnegative(),
});

export const PartnerSalesDashboardResponseSchema = z.object({
	period: z.object({
		selected: PartnerSalesDashboardDateRangeSchema,
		inactiveMonths: z.number().int().min(1).max(24),
		inactiveRange: PartnerSalesDashboardDateRangeSchema,
		timelineGranularity: PartnerSalesDashboardTimelineGranularitySchema,
	}),
	filters: z.object({
		supervisors: z.array(PartnerSalesDashboardSupervisorSummarySchema),
		partners: z.array(PartnerSalesDashboardPartnerFilterItemSchema),
	}),
	summary: PartnerSalesDashboardSummarySchema,
	ranking: z.array(PartnerSalesDashboardRankingItemSchema),
	timeline: z.array(PartnerSalesDashboardTimelineItemSchema),
	dynamicFieldBreakdown: z.object({
		availableFields: z.array(PartnerSalesDashboardDynamicFieldSchema),
		selectedFieldId: z.uuid().nullable(),
		selectedFieldLabel: z.string().nullable(),
		selectedFieldType: PartnerSalesDashboardDynamicFieldTypeSchema.nullable(),
		items: z.array(PartnerSalesDashboardDynamicFieldBreakdownItemSchema),
	}),
	productBreakdown: z.object({
		items: z.array(PartnerSalesDashboardProductBreakdownItemSchema),
	}),
	statusFunnel: z.object({
		items: z.array(PartnerSalesDashboardStatusFunnelItemSchema),
	}),
	pareto: z.object({
		items: z.array(PartnerSalesDashboardParetoItemSchema),
	}),
	ticketByPartner: z.object({
		items: z.array(PartnerSalesDashboardTicketByPartnerItemSchema),
	}),
	productionHealthTimeline: z.object({
		items: z.array(PartnerSalesDashboardProductionHealthTimelineItemSchema),
	}),
	commissionBreakdown: z.object({
		receivedAmount: z.number().int().nonnegative(),
		pendingAmount: z.number().int().nonnegative(),
		netRevenueAmount: z.number().int(),
		pendingByPartner: z.object({
			items: z.array(PartnerSalesDashboardCommissionPendingByPartnerItemSchema),
		}),
	}),
	delinquencyBreakdown: z.object({
		totalSales: z.number().int().nonnegative(),
		buckets: z.array(PartnerSalesDashboardDelinquencyBucketSchema),
	}),
	recencyBreakdown: z.object({
		buckets: z.array(PartnerSalesDashboardRecencyBucketSchema),
	}),
	riskRanking: z.object({
		items: z.array(PartnerSalesDashboardRiskRankingItemSchema),
	}),
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
			const baseCalculationBase =
				baseCommission?.calculationBase ?? "SALE_TOTAL";
			if (!baseCommission || baseCalculationBase !== "SALE_TOTAL") {
				ctx.addIssue({
					code: "custom",
					message: "Commission base must reference a SALE_TOTAL commission",
					path: ["commissions", commissionIndex, "baseCommissionIndex"],
				});
			}
		}
	});

export const CreateSaleBatchItemSchema = z
	.object({
		customerId: z.uuid(),
		productId: z.uuid(),
		saleDate: SaleDateInputSchema,
		totalAmount: z.number().int().positive(),
		dynamicFields: SaleDynamicFieldsInputSchema.optional(),
	})
	.strict();

export const CREATE_SALE_BATCH_MAX_ITEMS = 50;

export const CreateSaleBatchBodySchema = z
	.object({
		parentProductId: z.uuid(),
		responsible: SaleResponsibleSchema,
		companyId: z.uuid(),
		unitId: z.uuid().optional(),
		items: z
			.array(CreateSaleBatchItemSchema)
			.min(1)
			.max(CREATE_SALE_BATCH_MAX_ITEMS),
	})
	.strict();

export const CreateSaleBatchResponseSchema = z.object({
	saleIds: z.array(z.uuid()),
	createdCount: z.number().int().nonnegative(),
});

export const UpdateSaleBodySchema = CreateSaleBodySchema.extend({
	applyValueChangeToCommissions: z.boolean().optional(),
	reversePaidInstallmentsOnReduction: z.boolean().optional(),
	paidInstallmentsReversalDate: SaleDateInputSchema.optional(),
});

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

export const PatchCommissionInstallmentsStatusBulkBodySchema = z
	.object({
		installmentIds: z.array(z.uuid()).min(1).max(100),
		status: z.enum([
			SaleCommissionInstallmentStatus.PENDING,
			SaleCommissionInstallmentStatus.PAID,
			SaleCommissionInstallmentStatus.CANCELED,
		] as const),
		paymentDate: SaleDateInputSchema.optional(),
		reversalDate: SaleDateInputSchema.optional(),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (
			value.status === SaleCommissionInstallmentStatus.PAID &&
			!value.paymentDate
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["paymentDate"],
				message: "paymentDate is required when status is PAID",
			});
		}

		if (
			value.status === SaleCommissionInstallmentStatus.CANCELED &&
			!value.reversalDate
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["reversalDate"],
				message: "reversalDate is required when status is CANCELED",
			});
		}
	});

export const PatchCommissionInstallmentsStatusBulkSkippedReasonSchema = z.enum([
	"INVALID_STATUS_TRANSITION",
	"REVERSED_NOT_ALLOWED",
	"SALE_NOT_EDITABLE",
]);

export const PatchCommissionInstallmentsStatusBulkResponseSchema = z.object({
	updatedCount: z.number().int().nonnegative(),
	skipped: z.array(
		z.object({
			installmentId: z.uuid(),
			reason: PatchCommissionInstallmentsStatusBulkSkippedReasonSchema,
		}),
	),
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
		reversalDate: SaleDateInputSchema.optional(),
		amount: z.number().int().nonnegative().optional(),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (
			value.status === SaleCommissionInstallmentStatus.CANCELED &&
			!value.reversalDate
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["reversalDate"],
				message: "reversalDate is required when status is CANCELED",
			});
		}
	});

export const PatchSaleCommissionInstallmentBodySchema = z
	.object({
		percentage: CommissionPercentageSchema.optional(),
		amount: z.number().int().optional(),
		status: SaleCommissionInstallmentStatusSchema.optional(),
		expectedPaymentDate: SaleDateInputSchema.optional(),
		paymentDate: SaleDateInputSchema.nullable().optional(),
		reversalDate: SaleDateInputSchema.optional(),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (Object.keys(value).length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "At least one field must be provided",
			});
		}

		if (
			value.status === SaleCommissionInstallmentStatus.CANCELED &&
			!value.reversalDate
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["reversalDate"],
				message: "reversalDate is required when status is CANCELED",
			});
		}
	});

const NamedEntitySchema = z.object({
	id: z.uuid(),
	name: z.string(),
});

const UserSummarySchema = z.object({
	id: z.uuid(),
	name: z.string().nullable(),
	avatarUrl: z.string().nullable(),
});

export const SaleResponsiblePayloadSchema = z.object({
	type: SaleResponsibleTypeSchema,
	id: z.uuid(),
	name: z.string(),
});

export const SaleDelinquencySummarySchema = z.object({
	hasOpen: z.boolean(),
	openCount: z.number().int().nonnegative(),
	oldestDueDate: z.date().nullable(),
	latestDueDate: z.date().nullable(),
});

export const SaleDelinquencyOccurrenceSchema = z.object({
	id: z.uuid(),
	dueDate: z.date(),
	resolvedAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
	createdBy: UserSummarySchema,
	resolvedBy: UserSummarySchema.nullable(),
});

export const CreateSaleDelinquencyBodySchema = z
	.object({
		dueDate: SaleDateInputSchema.refine(
			(value) => value <= format(new Date(), "yyyy-MM-dd"),
			{
				message: "Delinquency due date cannot be in the future",
			},
		),
	})
	.strict();

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
	delinquencySummary: SaleDelinquencySummarySchema,
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
	delinquencySummary: SaleDelinquencySummarySchema,
	openDelinquencies: z.array(SaleDelinquencyOccurrenceSchema),
	delinquencyHistory: z.array(SaleDelinquencyOccurrenceSchema),
});

export const SaleDelinquencyListItemSchema = SaleSummarySchema.extend({
	openDelinquencies: z.array(SaleDelinquencyOccurrenceSchema),
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
export type GetPartnerSalesDashboardQuery = z.infer<
	typeof GetPartnerSalesDashboardQuerySchema
>;
export type CreateSaleBody = z.infer<typeof CreateSaleBodySchema>;
export type CreateSaleDelinquencyBody = z.infer<
	typeof CreateSaleDelinquencyBodySchema
>;
export type CreateSaleBatchItem = z.infer<typeof CreateSaleBatchItemSchema>;
export type CreateSaleBatchBody = z.infer<typeof CreateSaleBatchBodySchema>;
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
export type PatchCommissionInstallmentsStatusBulkBody = z.infer<
	typeof PatchCommissionInstallmentsStatusBulkBodySchema
>;
export type PatchCommissionInstallmentsStatusBulkSkippedReason = z.infer<
	typeof PatchCommissionInstallmentsStatusBulkSkippedReasonSchema
>;
export type PatchSaleCommissionInstallmentStatusBody = z.infer<
	typeof PatchSaleCommissionInstallmentStatusBodySchema
>;
export type PatchSaleCommissionInstallmentBody = z.infer<
	typeof PatchSaleCommissionInstallmentBodySchema
>;
export type SaleDelinquencySummary = z.infer<
	typeof SaleDelinquencySummarySchema
>;
export type SaleDelinquencyOccurrence = z.infer<
	typeof SaleDelinquencyOccurrenceSchema
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
