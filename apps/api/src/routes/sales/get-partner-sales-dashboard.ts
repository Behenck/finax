import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import {
	MemberDataScope,
	SaleCommissionInstallmentStatus,
	SaleDynamicFieldType,
	SaleResponsibleType,
	SaleStatus,
} from "generated/prisma/enums";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import {
	buildPartnersVisibilityWhere,
	buildSalesVisibilityWhere,
	loadMemberDataVisibilityContext,
} from "@/permissions/data-visibility";
import { getPartnerDisplayName } from "@/utils/partner-display";
import { loadSaleDelinquencySummaryBySaleIds } from "./sale-delinquencies";
import {
	GetPartnerSalesDashboardQuerySchema,
	PartnerSalesDashboardResponseSchema,
	parseSaleDateInput,
	type GetPartnerSalesDashboardQuery,
} from "./sale-schemas";
import { normalizePreCancellationDelinquencyThreshold } from "./sale-pre-cancellation";
import {
	parseSaleDynamicFieldSchemaJson,
	parseSaleDynamicFieldValuesJson,
	type SaleDynamicFieldSchemaSnapshot,
} from "./sale-dynamic-fields";

const PARTNER_DASHBOARD_SALE_STATUSES = [
	SaleStatus.PENDING,
	SaleStatus.COMPLETED,
] as const;
const PARTNER_DASHBOARD_FUNNEL_STATUSES = [
	SaleStatus.PENDING,
	SaleStatus.COMPLETED,
	SaleStatus.CANCELED,
] as const;
const DAY_TIMELINE_MAX_RANGE_DAYS = 90;
const PARTNER_DASHBOARD_TOP_LIST_LIMIT = 10;
const RECENCY_BUCKETS = [
	{ key: "RANGE_0_30", label: "0 a 30 dias", min: 0, max: 30 },
	{ key: "RANGE_31_60", label: "31 a 60 dias", min: 31, max: 60 },
	{ key: "RANGE_61_90", label: "61 a 90 dias", min: 61, max: 90 },
	{
		key: "RANGE_90_PLUS",
		label: "90+ dias",
		min: 91,
		max: Number.POSITIVE_INFINITY,
	},
	{ key: "NO_SALES", label: "Sem vendas", min: null, max: null },
] as const;

type VisiblePartner = {
	id: string;
	name: string;
	companyName: string;
	displayName: string;
	status: "ACTIVE" | "INACTIVE";
	supervisors: Array<{
		id: string;
		name: string | null;
	}>;
};

type DashboardSaleRow = {
	id: string;
	saleDate: Date;
	totalAmount: number;
	productId: string;
	responsibleId: string | null;
	createdById: string;
	dynamicFieldSchema: Prisma.JsonValue | null;
	dynamicFieldValues: Prisma.JsonValue | null;
};

type SupervisorRankingSaleRow = {
	id: string;
	saleDate: Date;
	totalAmount: number;
	status: SaleStatus;
	responsibleId: string | null;
	createdById: string;
	commissions: Array<{
		beneficiarySupervisor: {
			userId: string;
		} | null;
	}>;
};

type DashboardTimelineSaleByStatusRow = {
	saleDate: Date;
	totalAmount: number;
	status: SaleStatus;
};

type ProductRow = {
	id: string;
	name: string;
	parentId: string | null;
};

type ProductBreakdownDepth = "FIRST_LEVEL" | "ALL_LEVELS";

type TimelineGranularity = "DAY" | "MONTH";

type TimelineBucket = {
	key: string;
	date: Date;
	label: string;
};

type PartnerSummaryMetrics = {
	partnerId: string;
	partnerName: string;
	partnerCompanyName: string;
	status: "ACTIVE" | "INACTIVE";
	supervisors: Array<{
		id: string;
		name: string | null;
	}>;
	salesCount: number;
	grossAmount: number;
	averageTicket: number;
	commissionReceivedAmount: number;
	commissionPendingAmount: number;
	commissionReceivableCanceledAmount: number;
	commissionPayablePaidAmount: number;
	commissionPayablePendingAmount: number;
	commissionPayableCanceledAmount: number;
	netRevenueAmount: number;
	delinquentSalesCount: number;
	delinquentGrossAmount: number;
	delinquencyRateByCountPct: number;
	delinquencyRateByAmountPct: number;
	lastSaleDate: Date | null;
	recencyLastSaleDate: Date | null;
	salesBreakdown: {
		concluded: {
			salesCount: number;
			grossAmount: number;
		};
		pending: {
			salesCount: number;
			grossAmount: number;
		};
		canceled: {
			salesCount: number;
			grossAmount: number;
		};
	};
};

type DashboardBreakdownItem = {
	valueId: string;
	label: string;
	salesCount: number;
	grossAmount: number;
};

type PartnerCommissionDirectionTotals = {
	paidAmount: number;
	pendingAmount: number;
	canceledAmount: number;
};

type PartnerCommissionTotals = {
	income: PartnerCommissionDirectionTotals;
	outcome: PartnerCommissionDirectionTotals;
};

type SupervisorRankingSalesBreakdown = {
	concluded: {
		salesCount: number;
		grossAmount: number;
	};
	pending: {
		salesCount: number;
		grossAmount: number;
	};
	canceled: {
		salesCount: number;
		grossAmount: number;
	};
};

type SupervisorRankingPartnerMetrics = {
	partnerId: string;
	partnerName: string;
	partnerCompanyName: string;
	status: "ACTIVE" | "INACTIVE";
	salesCount: number;
	grossAmount: number;
	delinquentSalesCount: number;
	delinquentGrossAmount: number;
	salesBreakdown: SupervisorRankingSalesBreakdown;
};

type SupervisorRankingEntry = {
	supervisorId: string;
	supervisorName: string;
	salesCount: number;
	grossAmount: number;
	partners: Map<string, SupervisorRankingPartnerMetrics>;
};

const UNASSIGNED_SUPERVISOR_ID = "UNASSIGNED";
const UNASSIGNED_SUPERVISOR_NAME = "Sem supervisor";

function createUtcDate(year: number, monthIndex: number, day: number) {
	return new Date(Date.UTC(year, monthIndex, day));
}

function addUtcDays(date: Date, days: number) {
	return createUtcDate(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		date.getUTCDate() + days,
	);
}

function addUtcMonths(date: Date, months: number) {
	return createUtcDate(
		date.getUTCFullYear(),
		date.getUTCMonth() + months,
		date.getUTCDate(),
	);
}

function startOfUtcMonth(date: Date) {
	return createUtcDate(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function getUtcDateValue(date: Date) {
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function getUtcDateKey(date: Date) {
	const year = String(date.getUTCFullYear());
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function getUtcMonthKey(date: Date) {
	const year = String(date.getUTCFullYear());
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
}

function formatUtcDayLabel(date: Date) {
	const day = String(date.getUTCDate()).padStart(2, "0");
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	return `${day}/${month}`;
}

function formatUtcMonthLabel(date: Date) {
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const year = String(date.getUTCFullYear());
	return `${month}/${year}`;
}

function getUtcCalendarDayDifference(left: Date, right: Date) {
	return Math.floor(
		(getUtcDateValue(left) - getUtcDateValue(right)) / 86_400_000,
	);
}

function toPercentage(numerator: number, denominator: number) {
	if (denominator <= 0) {
		return 0;
	}

	const rawValue = (numerator / denominator) * 100;
	return Math.round(rawValue * 100) / 100;
}

function toAverageAmount(total: number, count: number) {
	if (count <= 0) {
		return 0;
	}

	return Math.round(total / count);
}

function resolveTimelineGranularity(
	startDate: Date,
	endDate: Date,
): TimelineGranularity {
	return getUtcCalendarDayDifference(endDate, startDate) <=
		DAY_TIMELINE_MAX_RANGE_DAYS
		? "DAY"
		: "MONTH";
}

function buildTimelineBuckets(
	startDate: Date,
	endDate: Date,
	granularity: TimelineGranularity,
) {
	const buckets: TimelineBucket[] = [];

	if (granularity === "DAY") {
		for (
			let cursor = startDate;
			cursor <= endDate;
			cursor = addUtcDays(cursor, 1)
		) {
			buckets.push({
				key: getUtcDateKey(cursor),
				date: cursor,
				label: formatUtcDayLabel(cursor),
			});
		}
		return buckets;
	}

	for (
		let cursor = startOfUtcMonth(startDate);
		cursor <= endDate;
		cursor = createUtcDate(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)
	) {
		buckets.push({
			key: getUtcMonthKey(cursor),
			date: cursor,
			label: formatUtcMonthLabel(cursor),
		});
	}

	return buckets;
}

function buildPartnerNameSorter<T extends { name: string | null }>() {
	return (left: T, right: T) =>
		(left.name ?? "").localeCompare(right.name ?? "", "pt-BR");
}

function resolveEligibleDynamicFields(sales: DashboardSaleRow[]) {
	const fields = new Map<
		string,
		{
			fieldId: string;
			label: string;
			type: "SELECT" | "MULTI_SELECT";
		}
	>();

	for (const sale of sales) {
		const schema = parseSaleDynamicFieldSchemaJson(sale.dynamicFieldSchema);

		for (const field of schema) {
			if (
				field.type !== SaleDynamicFieldType.SELECT &&
				field.type !== SaleDynamicFieldType.MULTI_SELECT
			) {
				continue;
			}

			if (fields.has(field.fieldId)) {
				continue;
			}

			fields.set(field.fieldId, {
				fieldId: field.fieldId,
				label: field.label,
				type: field.type,
			});
		}
	}

	return Array.from(fields.values()).sort((left, right) =>
		left.label.localeCompare(right.label, "pt-BR"),
	);
}

function resolveDynamicFieldOptionLabel(
	field: SaleDynamicFieldSchemaSnapshot[number],
	optionId: string,
) {
	return (
		field.options.find((option) => option.id === optionId)?.label ?? optionId
	);
}

function addBreakdownValue(
	breakdownByValueId: Map<string, DashboardBreakdownItem>,
	params: {
		valueId: string;
		label: string;
		grossAmount: number;
	},
) {
	const current = breakdownByValueId.get(params.valueId) ?? {
		valueId: params.valueId,
		label: params.label,
		salesCount: 0,
		grossAmount: 0,
	};

	current.salesCount += 1;
	current.grossAmount += params.grossAmount;
	breakdownByValueId.set(params.valueId, current);
}

function buildDynamicFieldBreakdown(
	sales: DashboardSaleRow[],
	selectedFieldId?: string,
) {
	const availableFields = resolveEligibleDynamicFields(sales);
	const selectedField =
		availableFields.find((field) => field.fieldId === selectedFieldId) ??
		availableFields[0] ??
		null;

	if (!selectedField) {
		return {
			availableFields,
			selectedFieldId: null,
			selectedFieldLabel: null,
			selectedFieldType: null,
			items: [],
		};
	}

	const breakdownByValueId = new Map<string, DashboardBreakdownItem>();

	for (const sale of sales) {
		const schema = parseSaleDynamicFieldSchemaJson(sale.dynamicFieldSchema);
		const values = parseSaleDynamicFieldValuesJson(sale.dynamicFieldValues);
		const field = schema.find((item) => item.fieldId === selectedField.fieldId);
		if (!field) {
			continue;
		}

		const rawValue = values[selectedField.fieldId];
		if (field.type === SaleDynamicFieldType.SELECT) {
			if (typeof rawValue !== "string" || !rawValue.trim()) {
				continue;
			}

			addBreakdownValue(breakdownByValueId, {
				valueId: rawValue,
				label: resolveDynamicFieldOptionLabel(field, rawValue),
				grossAmount: sale.totalAmount,
			});
			continue;
		}

		if (field.type === SaleDynamicFieldType.MULTI_SELECT) {
			if (!Array.isArray(rawValue)) {
				continue;
			}

			const selectedOptionIds = Array.from(
				new Set(
					rawValue.filter(
						(value): value is string => typeof value === "string",
					),
				),
			);
			for (const optionId of selectedOptionIds) {
				addBreakdownValue(breakdownByValueId, {
					valueId: optionId,
					label: resolveDynamicFieldOptionLabel(field, optionId),
					grossAmount: sale.totalAmount,
				});
			}
		}
	}

	return {
		availableFields,
		selectedFieldId: selectedField.fieldId,
		selectedFieldLabel: selectedField.label,
		selectedFieldType: selectedField.type,
		items: Array.from(breakdownByValueId.values()).sort(
			(left, right) =>
				right.salesCount - left.salesCount ||
				right.grossAmount - left.grossAmount ||
				left.label.localeCompare(right.label, "pt-BR"),
		),
	};
}

function buildProductPathResolver(products: ProductRow[]) {
	const productsById = new Map(
		products.map((product) => [product.id, product]),
	);
	const pathMemo = new Map<string, ProductRow[]>();

	function getProductPath(
		productId: string,
		visited = new Set<string>(),
	): ProductRow[] {
		const cachedPath = pathMemo.get(productId);
		if (cachedPath) {
			return cachedPath;
		}

		const product = productsById.get(productId);
		if (!product) {
			return [];
		}

		if (visited.has(productId)) {
			return [product];
		}

		const nextVisited = new Set(visited);
		nextVisited.add(productId);

		const path: ProductRow[] =
			product.parentId === null
				? [product]
				: [...getProductPath(product.parentId, nextVisited), product];

		pathMemo.set(productId, path);
		return path;
	}

	return getProductPath;
}

function buildProductBreakdown(
	sales: DashboardSaleRow[],
	products: ProductRow[],
	depth: ProductBreakdownDepth,
) {
	const getProductPath = buildProductPathResolver(products);
	const breakdownByProductId = new Map<string, DashboardBreakdownItem>();

	for (const sale of sales) {
		const productPath = getProductPath(sale.productId);
		if (productPath.length === 0) {
			continue;
		}

		const rootProduct = productPath[0]!;
		const firstLevelChild = productPath[1] ?? null;
		const productPathLabel = productPath
			.map((product) => product.name)
			.join(" -> ");
		const valueId =
			depth === "ALL_LEVELS"
				? sale.productId
				: firstLevelChild
					? firstLevelChild.id
					: `ROOT:${rootProduct.id}`;
		const label =
			depth === "ALL_LEVELS"
				? productPath.length === 1
					? `${rootProduct.name} (Somente produto pai)`
					: productPathLabel
				: firstLevelChild
					? `${rootProduct.name} -> ${firstLevelChild.name}`
					: `${rootProduct.name} (Somente produto pai)`;

		addBreakdownValue(breakdownByProductId, {
			valueId,
			label,
			grossAmount: sale.totalAmount,
		});
	}

	return {
		items: Array.from(breakdownByProductId.values()).sort(
			(left, right) =>
				right.salesCount - left.salesCount ||
				right.grossAmount - left.grossAmount ||
				left.label.localeCompare(right.label, "pt-BR"),
		),
	};
}

function formatDelinquencyCountBucketLabel(
	count: number,
	includeOrMore = false,
) {
	const baseLabel = `${count} inadimpl${count === 1 ? "ência" : "ências"}`;
	return includeOrMore ? `${baseLabel} ou mais` : baseLabel;
}

function buildEmptyDelinquencyBuckets(
	preCancellationThreshold: number | null,
	maxObservedOpenCount: number,
) {
	if (preCancellationThreshold !== null) {
		const buckets = Array.from(
			{ length: Math.max(preCancellationThreshold - 1, 0) },
			(_, index) => {
				const openCount = index + 1;
				return {
					key: `OPEN_COUNT_${openCount}`,
					label: formatDelinquencyCountBucketLabel(openCount),
					openCount,
					isPreCancellationBucket: false,
					salesCount: 0,
					grossAmount: 0,
				};
			},
		);

		buckets.push({
			key: "PRE_CANCELLATION",
			label: "Pré-cancelamento",
			openCount: preCancellationThreshold,
			isPreCancellationBucket: true,
			salesCount: 0,
			grossAmount: 0,
		});

		return buckets;
	}

	const bucketCount = Math.max(maxObservedOpenCount, 1);

	return Array.from({ length: bucketCount }, (_, index) => {
		const openCount = index + 1;

		return {
			key: `OPEN_COUNT_${openCount}`,
			label: formatDelinquencyCountBucketLabel(openCount),
			openCount,
			isPreCancellationBucket: false,
			salesCount: 0,
			grossAmount: 0,
		};
	});
}

function resolveDelinquencyBucketIndex(params: {
	openCount: number;
	preCancellationThreshold: number | null;
	bucketCount: number;
}) {
	if (params.openCount <= 0) {
		return null;
	}

	if (
		params.preCancellationThreshold !== null &&
		params.openCount >= params.preCancellationThreshold
	) {
		return params.bucketCount - 1;
	}

	return Math.min(params.openCount, params.bucketCount) - 1;
}

function toPublicDelinquencyBuckets(
	buckets: ReturnType<typeof buildEmptyDelinquencyBuckets>,
) {
	return buckets.map((bucket) => ({
		key: bucket.key,
		label: bucket.label,
		salesCount: bucket.salesCount,
		grossAmount: bucket.grossAmount,
	}));
}

function buildEmptyRecencyBuckets() {
	return RECENCY_BUCKETS.map((bucket) => ({
		key: bucket.key,
		label: bucket.label,
		partnersCount: 0,
	}));
}

function getRecencyBucketKey(ageInDays: number | null) {
	if (ageInDays === null) {
		return "NO_SALES";
	}

	for (const bucket of RECENCY_BUCKETS) {
		if (bucket.min === null || bucket.max === null) {
			continue;
		}

		if (ageInDays >= bucket.min && ageInDays <= bucket.max) {
			return bucket.key;
		}
	}

	return "RANGE_90_PLUS";
}

function getStatusLabel(
	status: (typeof PARTNER_DASHBOARD_FUNNEL_STATUSES)[number],
) {
	if (status === SaleStatus.PENDING) {
		return "Pendente";
	}

	if (status === SaleStatus.COMPLETED) {
		return "Concluída";
	}

	return "Cancelada";
}

function createEmptyRankingSalesBreakdown() {
	return {
		concluded: {
			salesCount: 0,
			grossAmount: 0,
		},
		pending: {
			salesCount: 0,
			grossAmount: 0,
		},
		canceled: {
			salesCount: 0,
			grossAmount: 0,
		},
	};
}

function createEmptySupervisorRankingSalesBreakdown(): SupervisorRankingSalesBreakdown {
	return {
		concluded: {
			salesCount: 0,
			grossAmount: 0,
		},
		pending: {
			salesCount: 0,
			grossAmount: 0,
		},
		canceled: {
			salesCount: 0,
			grossAmount: 0,
		},
	};
}

function createEmptyPartnerCommissionTotals(): PartnerCommissionTotals {
	return {
		income: {
			paidAmount: 0,
			pendingAmount: 0,
			canceledAmount: 0,
		},
		outcome: {
			paidAmount: 0,
			pendingAmount: 0,
			canceledAmount: 0,
		},
	};
}

function splitAmountAcrossAssignments(
	totalAmount: number,
	assignmentsCount: number,
	index: number,
) {
	if (assignmentsCount <= 1) {
		return totalAmount;
	}

	const baseAmount = Math.floor(totalAmount / assignmentsCount);
	const remainder = totalAmount % assignmentsCount;
	return baseAmount + (index < remainder ? 1 : 0);
}

function resolveSupervisorRankingBreakdownBucket(
	breakdown: SupervisorRankingSalesBreakdown,
	status: SaleStatus,
) {
	if (status === SaleStatus.PENDING) {
		return breakdown.pending;
	}

	if (status === SaleStatus.CANCELED) {
		return breakdown.canceled;
	}

	return breakdown.concluded;
}

export async function getPartnerSalesDashboard(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/sales/dashboard/partners",
			{
				schema: {
					tags: ["sales"],
					summary: "Get partner sales dashboard",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					querystring: GetPartnerSalesDashboardQuerySchema,
					response: {
						200: PartnerSalesDashboardResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const {
					startDate: startDateInput,
					endDate: endDateInput,
					inactiveMonths,
					supervisorId,
					partnerIds,
					dynamicFieldId,
					productBreakdownDepth,
				} = request.query as GetPartnerSalesDashboardQuery;

				const { organization, membership } =
					await request.getUserMembership(slug);
				const canViewAllSales = await request.hasPermission(
					slug,
					"sales.view.all",
				);
				const canViewAllPartners = await request.hasPermission(
					slug,
					"registers.partners.view.all",
				);
				const visibilityContext = await loadMemberDataVisibilityContext({
					organizationId: organization.id,
					memberId: membership.id,
					userId: membership.userId,
					role: membership.role,
					customersScope: membership.customersScope,
					salesScope: canViewAllSales
						? MemberDataScope.ORGANIZATION_ALL
						: membership.salesScope,
					commissionsScope: membership.commissionsScope,
					partnersScope: canViewAllPartners
						? MemberDataScope.ORGANIZATION_ALL
						: membership.partnersScope,
				});

				const startDate = parseSaleDateInput(startDateInput);
				const endDate = parseSaleDateInput(endDateInput);
				const inactivityStartDate = addUtcMonths(endDate, -inactiveMonths);
				const preCancellationThreshold =
					normalizePreCancellationDelinquencyThreshold(
						organization.preCancellationDelinquencyThreshold,
					);
				const partnerIdFilterSet = partnerIds ? new Set(partnerIds) : null;
				const partnersVisibilityWhere =
					buildPartnersVisibilityWhere(visibilityContext);
				const visiblePartners = (
					await prisma.partner.findMany({
						where: {
							organizationId: organization.id,
							...partnersVisibilityWhere,
						},
						select: {
							id: true,
							name: true,
							companyName: true,
							status: true,
							supervisors: {
								select: {
									supervisor: {
										select: {
											id: true,
											name: true,
										},
									},
								},
							},
						},
					})
				).map((partner) => ({
					id: partner.id,
					name: partner.name ?? partner.companyName,
					companyName: partner.companyName,
					displayName: getPartnerDisplayName(partner),
					status: partner.status,
					supervisors: partner.supervisors.map((link) => link.supervisor),
				})) satisfies VisiblePartner[];

				const filterSupervisors = Array.from(
					new Map(
						visiblePartners
							.flatMap((partner) => partner.supervisors)
							.map((supervisor) => [supervisor.id, supervisor]),
					).values(),
				).sort(buildPartnerNameSorter());
				const filterPartners = visiblePartners
					.map((partner) => ({
						id: partner.id,
						name: partner.displayName,
						partnerName: partner.name,
						partnerCompanyName: partner.companyName,
						status: partner.status,
						supervisors: partner.supervisors,
					}))
					.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
				const filteredPartners = visiblePartners.filter((partner) => {
					if (
						supervisorId &&
						!partner.supervisors.some(
							(supervisor) => supervisor.id === supervisorId,
						)
					) {
						return false;
					}

					if (partnerIdFilterSet && !partnerIdFilterSet.has(partner.id)) {
						return false;
					}

					return true;
				});
				const filteredPartnerIds = filteredPartners.map(
					(partner) => partner.id,
				);
				const filteredPartnerById = new Map(
					filteredPartners.map((partner) => [partner.id, partner]),
				);
				const supervisorNameById = new Map(
					filterSupervisors.map((supervisor) => [
						supervisor.id,
						supervisor.name?.trim() || UNASSIGNED_SUPERVISOR_NAME,
					]),
				);
				const salesVisibilityWhere =
					buildSalesVisibilityWhere(visibilityContext);
				const dashboardSalesWhere: Prisma.SaleWhereInput = {
					AND: [
						{
							organizationId: organization.id,
						},
						{
							status: {
								in: [...PARTNER_DASHBOARD_SALE_STATUSES],
							},
						},
						{
							responsibleType: SaleResponsibleType.PARTNER,
						},
						{
							responsibleId: {
								in: filteredPartnerIds,
							},
						},
						{
							saleDate: {
								gte: startDate,
								lte: endDate,
							},
						},
						...(salesVisibilityWhere ? [salesVisibilityWhere] : []),
					],
				};

				const inactivitySalesWhere: Prisma.SaleWhereInput = {
					AND: [
						{
							organizationId: organization.id,
						},
						{
							status: {
								in: [...PARTNER_DASHBOARD_SALE_STATUSES],
							},
						},
						{
							responsibleType: SaleResponsibleType.PARTNER,
						},
						{
							responsibleId: {
								in: filteredPartnerIds,
							},
						},
						{
							saleDate: {
								gte: inactivityStartDate,
								lte: endDate,
							},
						},
						...(salesVisibilityWhere ? [salesVisibilityWhere] : []),
					],
				};

				const statusFunnelSalesWhere: Prisma.SaleWhereInput = {
					AND: [
						{
							organizationId: organization.id,
						},
						{
							status: {
								in: [...PARTNER_DASHBOARD_FUNNEL_STATUSES],
							},
						},
						{
							responsibleType: SaleResponsibleType.PARTNER,
						},
						{
							responsibleId: {
								in: filteredPartnerIds,
							},
						},
						{
							saleDate: {
								gte: startDate,
								lte: endDate,
							},
						},
						...(salesVisibilityWhere ? [salesVisibilityWhere] : []),
					],
				};
				const partnerLatestSaleWhere: Prisma.SaleWhereInput = {
					AND: [
						{
							organizationId: organization.id,
						},
						{
							status: {
								in: [...PARTNER_DASHBOARD_SALE_STATUSES],
							},
						},
						{
							responsibleType: SaleResponsibleType.PARTNER,
						},
						{
							responsibleId: {
								in: filteredPartnerIds,
							},
						},
						{
							saleDate: {
								lte: endDate,
							},
						},
						...(salesVisibilityWhere ? [salesVisibilityWhere] : []),
					],
				};

				const [
					sales,
					supervisorRankingSalesRows,
					partnersWithRecentSalesRows,
					products,
					statusFunnelRows,
					partnerStatusRows,
					timelineSalesByStatusRows,
					partnerLatestSaleRows,
				] = await Promise.all([
					filteredPartnerIds.length > 0
						? prisma.sale.findMany({
								where: dashboardSalesWhere,
								select: {
									id: true,
									saleDate: true,
									totalAmount: true,
									productId: true,
									responsibleId: true,
									createdById: true,
									dynamicFieldSchema: true,
									dynamicFieldValues: true,
								},
							})
						: Promise.resolve([]),
					filteredPartnerIds.length > 0
						? prisma.sale.findMany({
								where: statusFunnelSalesWhere,
								select: {
									id: true,
									saleDate: true,
									totalAmount: true,
									status: true,
									responsibleId: true,
									createdById: true,
									commissions: {
										select: {
											beneficiarySupervisor: {
												select: {
													userId: true,
												},
											},
										},
									},
								},
							})
						: Promise.resolve([]),
					filteredPartnerIds.length > 0
						? prisma.sale.groupBy({
								by: ["responsibleId"],
								where: inactivitySalesWhere,
							})
						: Promise.resolve([]),
					prisma.product.findMany({
						where: {
							organizationId: organization.id,
						},
						select: {
							id: true,
							name: true,
							parentId: true,
						},
					}),
					filteredPartnerIds.length > 0
						? prisma.sale.groupBy({
								by: ["status"],
								where: statusFunnelSalesWhere,
								_count: {
									_all: true,
								},
								_sum: {
									totalAmount: true,
								},
							})
						: Promise.resolve([]),
					filteredPartnerIds.length > 0
						? prisma.sale.groupBy({
								by: ["responsibleId", "status"],
								where: statusFunnelSalesWhere,
								_count: {
									_all: true,
								},
								_sum: {
									totalAmount: true,
								},
							})
						: Promise.resolve([]),
					filteredPartnerIds.length > 0
						? prisma.sale.findMany({
								where: statusFunnelSalesWhere,
								select: {
									saleDate: true,
									totalAmount: true,
									status: true,
								},
							})
						: Promise.resolve([]),
					filteredPartnerIds.length > 0
						? prisma.sale.groupBy({
								by: ["responsibleId"],
								where: partnerLatestSaleWhere,
								_max: {
									saleDate: true,
								},
							})
						: Promise.resolve([]),
				]);

				const saleIds = sales.map((sale) => sale.id);
				const [delinquencySummaryBySaleId, commissionInstallmentsBySalePeriod] =
					await Promise.all([
						loadSaleDelinquencySummaryBySaleIds(
							prisma,
							organization.id,
							saleIds,
						),
						saleIds.length > 0
							? prisma.saleCommissionInstallment.findMany({
									where: {
										saleCommission: {
											saleId: {
												in: saleIds,
											},
										},
									},
									select: {
										amount: true,
										status: true,
										saleCommission: {
											select: {
												direction: true,
												sale: {
													select: {
														responsibleId: true,
													},
												},
											},
										},
									},
								})
							: Promise.resolve([]),
					]);

				const salesByPartnerId = new Map<string, DashboardSaleRow[]>();
				for (const sale of sales) {
					if (!sale.responsibleId) {
						continue;
					}

					const currentSales = salesByPartnerId.get(sale.responsibleId) ?? [];
					currentSales.push(sale);
					salesByPartnerId.set(sale.responsibleId, currentSales);
				}

				const commissionTotalsByPartnerId = new Map<
					string,
					PartnerCommissionTotals
				>();
				for (const installment of commissionInstallmentsBySalePeriod) {
					const partnerId = installment.saleCommission.sale.responsibleId;
					if (!partnerId) {
						continue;
					}

					const currentTotals =
						commissionTotalsByPartnerId.get(partnerId) ??
						createEmptyPartnerCommissionTotals();
					const directionTotals =
						installment.saleCommission.direction === "INCOME"
							? currentTotals.income
							: currentTotals.outcome;

					if (installment.status === SaleCommissionInstallmentStatus.PAID) {
						directionTotals.paidAmount += installment.amount;
					} else if (
						installment.status === SaleCommissionInstallmentStatus.PENDING
					) {
						directionTotals.pendingAmount += installment.amount;
					} else if (
						installment.status === SaleCommissionInstallmentStatus.CANCELED
					) {
						directionTotals.canceledAmount += installment.amount;
					}

					commissionTotalsByPartnerId.set(partnerId, currentTotals);
				}

				const timelineGranularity = resolveTimelineGranularity(
					startDate,
					endDate,
				);
				const timelineBuckets = buildTimelineBuckets(
					startDate,
					endDate,
					timelineGranularity,
				);
				const timelineSummaryByKey = new Map<
					string,
					{
						salesCount: number;
						grossAmount: number;
						concludedGrossAmount: number;
						processedGrossAmount: number;
						concludedAndProcessedGrossAmount: number;
						canceledGrossAmount: number;
					}
				>(
					timelineBuckets.map((bucket) => [
						bucket.key,
						{
							salesCount: 0,
							grossAmount: 0,
							concludedGrossAmount: 0,
							processedGrossAmount: 0,
							concludedAndProcessedGrossAmount: 0,
							canceledGrossAmount: 0,
						},
					]),
				);
				for (const sale of sales) {
					const bucketKey =
						timelineGranularity === "DAY"
							? getUtcDateKey(sale.saleDate)
							: getUtcMonthKey(sale.saleDate);
					const bucketSummary = timelineSummaryByKey.get(bucketKey);
					if (!bucketSummary) {
						continue;
					}

					bucketSummary.salesCount += 1;
					bucketSummary.grossAmount += sale.totalAmount;
				}
				for (const sale of timelineSalesByStatusRows as DashboardTimelineSaleByStatusRow[]) {
					const bucketKey =
						timelineGranularity === "DAY"
							? getUtcDateKey(sale.saleDate)
							: getUtcMonthKey(sale.saleDate);
					const bucketSummary = timelineSummaryByKey.get(bucketKey);
					if (!bucketSummary) {
						continue;
					}

					if (sale.status === SaleStatus.PENDING) {
						bucketSummary.processedGrossAmount += sale.totalAmount;
						bucketSummary.concludedAndProcessedGrossAmount += sale.totalAmount;
						continue;
					}

					if (sale.status === SaleStatus.COMPLETED) {
						bucketSummary.concludedGrossAmount += sale.totalAmount;
						bucketSummary.concludedAndProcessedGrossAmount += sale.totalAmount;
						continue;
					}

					if (sale.status === SaleStatus.CANCELED) {
						bucketSummary.canceledGrossAmount += sale.totalAmount;
					}
				}

				const timeline = timelineBuckets.map((bucket) => {
					const summary = timelineSummaryByKey.get(bucket.key) ?? {
						salesCount: 0,
						grossAmount: 0,
						concludedGrossAmount: 0,
						processedGrossAmount: 0,
						concludedAndProcessedGrossAmount: 0,
						canceledGrossAmount: 0,
					};
					return {
						label: bucket.label,
						date: bucket.date,
						salesCount: summary.salesCount,
						grossAmount: summary.grossAmount,
						concludedGrossAmount: summary.concludedGrossAmount,
						processedGrossAmount: summary.processedGrossAmount,
						concludedAndProcessedGrossAmount:
							summary.concludedAndProcessedGrossAmount,
						canceledGrossAmount: summary.canceledGrossAmount,
					};
				});
				const monthlyProductionBuckets = buildTimelineBuckets(
					startDate,
					endDate,
					"MONTH",
				);
				const producingPartnersByMonthKey = new Map<string, Set<string>>(
					monthlyProductionBuckets.map((bucket) => [
						bucket.key,
						new Set<string>(),
					]),
				);
				for (const sale of sales) {
					if (!sale.responsibleId) {
						continue;
					}

					const bucketKey = getUtcMonthKey(sale.saleDate);
					const partnerSet = producingPartnersByMonthKey.get(bucketKey);
					if (!partnerSet) {
						continue;
					}

					partnerSet.add(sale.responsibleId);
				}
				const productionHealthTimeline = {
					items: monthlyProductionBuckets.map((bucket) => {
						const producingPartnersInMonth =
							producingPartnersByMonthKey.get(bucket.key)?.size ?? 0;
						return {
							date: bucket.date,
							label: bucket.label,
							producingPartners: producingPartnersInMonth,
							totalPartners: filteredPartners.length,
							producingRatePct: toPercentage(
								producingPartnersInMonth,
								filteredPartners.length,
							),
						};
					}),
				};

				const dynamicFieldBreakdown = buildDynamicFieldBreakdown(
					sales,
					dynamicFieldId,
				);
				const productBreakdown = buildProductBreakdown(
					sales,
					products,
					productBreakdownDepth,
				);
				const partnersWithRecentSales = new Set(
					partnersWithRecentSalesRows
						.map((row) => row.responsibleId)
						.filter((value): value is string => typeof value === "string"),
				);
				const maxObservedOpenDelinquencyCount = sales.reduce(
					(currentMax, sale) => {
						const openCount =
							delinquencySummaryBySaleId.get(sale.id)?.openCount ?? 0;
						return Math.max(currentMax, openCount);
					},
					0,
				);
				const delinquencyBuckets = buildEmptyDelinquencyBuckets(
					preCancellationThreshold,
					maxObservedOpenDelinquencyCount,
				);
				let preCancellationSalesCount = 0;
				let preCancellationGrossAmount = 0;
				const recencyBuckets = buildEmptyRecencyBuckets();
				const recencyBucketIndexByKey = new Map(
					recencyBuckets.map((bucket, index) => [bucket.key, index]),
				);
				const recencyLastSaleByPartnerId = new Map(
					partnerLatestSaleRows
						.filter(
							(
								row,
							): row is {
								responsibleId: string;
								_max: { saleDate: Date | null };
							} => typeof row.responsibleId === "string",
						)
						.map((row) => [row.responsibleId, row._max.saleDate]),
				);
				const partnerSalesBreakdownByPartnerId = new Map<
					string,
					PartnerSummaryMetrics["salesBreakdown"]
				>();
				for (const row of partnerStatusRows) {
					if (typeof row.responsibleId !== "string") {
						continue;
					}

					const current =
						partnerSalesBreakdownByPartnerId.get(row.responsibleId) ??
						createEmptyRankingSalesBreakdown();
					const salesCount = row._count._all;
					const grossAmount = row._sum.totalAmount ?? 0;

					if (row.status === SaleStatus.PENDING) {
						current.pending.salesCount += salesCount;
						current.pending.grossAmount += grossAmount;
					} else if (row.status === SaleStatus.CANCELED) {
						current.canceled.salesCount += salesCount;
						current.canceled.grossAmount += grossAmount;
					} else {
						current.concluded.salesCount += salesCount;
						current.concluded.grossAmount += grossAmount;
					}

					partnerSalesBreakdownByPartnerId.set(row.responsibleId, current);
				}

				const supervisorRankingById = new Map<string, SupervisorRankingEntry>();
				for (const sale of supervisorRankingSalesRows as SupervisorRankingSaleRow[]) {
					if (!sale.responsibleId) {
						continue;
					}

					const partner = filteredPartnerById.get(sale.responsibleId);
					if (!partner) {
						continue;
					}

					const eligibleSupervisorIds = new Set(
						partner.supervisors.map((supervisor) => supervisor.id),
					);
					const commissionSupervisorIds = Array.from(
						new Set(
							sale.commissions
								.map((commission) => commission.beneficiarySupervisor?.userId)
								.filter(
									(supervisorUserId): supervisorUserId is string =>
										typeof supervisorUserId === "string" &&
										eligibleSupervisorIds.has(supervisorUserId),
								),
						),
					);
					const assignedSupervisorIds =
						commissionSupervisorIds.length > 0
							? commissionSupervisorIds
							: eligibleSupervisorIds.has(sale.createdById)
								? [sale.createdById]
								: [UNASSIGNED_SUPERVISOR_ID];
					const assignmentsCount = assignedSupervisorIds.length;
					const delinquencySummary = delinquencySummaryBySaleId.get(sale.id);
					const hasDelinquency = Boolean(delinquencySummary?.hasOpen);
					const distributedSalesCount = 1 / assignmentsCount;

					for (const [assignmentIndex, assignedSupervisorId] of assignedSupervisorIds.entries()) {
						const distributedAmount = splitAmountAcrossAssignments(
							sale.totalAmount,
							assignmentsCount,
							assignmentIndex,
						);
						const supervisorName =
							assignedSupervisorId === UNASSIGNED_SUPERVISOR_ID
								? UNASSIGNED_SUPERVISOR_NAME
								: supervisorNameById.get(assignedSupervisorId) ??
									UNASSIGNED_SUPERVISOR_NAME;
						const currentSupervisor =
							supervisorRankingById.get(assignedSupervisorId) ??
							{
								supervisorId: assignedSupervisorId,
								supervisorName,
								salesCount: 0,
								grossAmount: 0,
								partners: new Map<string, SupervisorRankingPartnerMetrics>(),
							};

						currentSupervisor.salesCount += distributedSalesCount;
						currentSupervisor.grossAmount += distributedAmount;

						const currentPartner =
							currentSupervisor.partners.get(partner.id) ??
							{
								partnerId: partner.id,
								partnerName: partner.name,
								partnerCompanyName: partner.companyName,
								status: partner.status,
								salesCount: 0,
								grossAmount: 0,
								delinquentSalesCount: 0,
								delinquentGrossAmount: 0,
								salesBreakdown:
									createEmptySupervisorRankingSalesBreakdown(),
							};

						currentPartner.salesCount += distributedSalesCount;
						currentPartner.grossAmount += distributedAmount;

						const breakdownBucket = resolveSupervisorRankingBreakdownBucket(
							currentPartner.salesBreakdown,
							sale.status,
						);
						breakdownBucket.salesCount += distributedSalesCount;
						breakdownBucket.grossAmount += distributedAmount;

						if (hasDelinquency) {
							currentPartner.delinquentSalesCount += distributedSalesCount;
							currentPartner.delinquentGrossAmount += distributedAmount;
						}

						currentSupervisor.partners.set(partner.id, currentPartner);
						supervisorRankingById.set(
							assignedSupervisorId,
							currentSupervisor,
						);
					}
				}

				const supervisorRanking = {
					items: [...supervisorRankingById.values()]
						.filter((supervisor) =>
							supervisorId
								? supervisor.supervisorId === supervisorId ||
									supervisor.supervisorId === UNASSIGNED_SUPERVISOR_ID
								: true,
						)
						.map((supervisor) => {
							const partners = [...supervisor.partners.values()].sort(
								(left, right) =>
									right.grossAmount - left.grossAmount ||
									right.salesCount - left.salesCount ||
									left.partnerName.localeCompare(right.partnerName, "pt-BR"),
							);

							return {
								supervisorId: supervisor.supervisorId,
								supervisorName: supervisor.supervisorName,
								partnersCount: partners.length,
								salesCount: supervisor.salesCount,
								grossAmount: supervisor.grossAmount,
								partners,
							};
						})
						.sort(
							(left, right) =>
								right.grossAmount - left.grossAmount ||
								right.salesCount - left.salesCount ||
								left.supervisorName.localeCompare(
									right.supervisorName,
									"pt-BR",
								),
						),
				};

				const partnerMetrics = filteredPartners.map((partner) => {
					const partnerSales = salesByPartnerId.get(partner.id) ?? [];
					const partnerGrossAmount = partnerSales.reduce(
						(sum, sale) => sum + sale.totalAmount,
						0,
					);
					const commissionTotals =
						commissionTotalsByPartnerId.get(partner.id) ??
						createEmptyPartnerCommissionTotals();
					const partnerNetRevenue =
						commissionTotals.income.paidAmount -
						commissionTotals.outcome.paidAmount;
					const partnerSalesBreakdown =
						partnerSalesBreakdownByPartnerId.get(partner.id) ??
						createEmptyRankingSalesBreakdown();

					let partnerDelinquentSalesCount = 0;
					let partnerDelinquentGrossAmount = 0;
					for (const sale of partnerSales) {
						const delinquencySummary = delinquencySummaryBySaleId.get(sale.id);
						if (!delinquencySummary?.hasOpen) {
							continue;
						}

						partnerDelinquentSalesCount += 1;
						partnerDelinquentGrossAmount += sale.totalAmount;

						if (
							preCancellationThreshold !== null &&
							delinquencySummary.openCount >= preCancellationThreshold
						) {
							preCancellationSalesCount += 1;
							preCancellationGrossAmount += sale.totalAmount;
						}

						const bucketIndex = resolveDelinquencyBucketIndex({
							openCount: delinquencySummary.openCount,
							preCancellationThreshold,
							bucketCount: delinquencyBuckets.length,
						});
						if (bucketIndex === null) {
							continue;
						}

						delinquencyBuckets[bucketIndex]!.salesCount += 1;
						delinquencyBuckets[bucketIndex]!.grossAmount += sale.totalAmount;
					}

					const lastSaleDate =
						partnerSales
							.map((sale) => sale.saleDate)
							.sort((left, right) => right.getTime() - left.getTime())[0] ??
						null;
					const recencyLastSaleDate =
						recencyLastSaleByPartnerId.get(partner.id) ?? null;
					const recencyAgeInDays = recencyLastSaleDate
						? getUtcCalendarDayDifference(endDate, recencyLastSaleDate)
						: null;
					const recencyBucketKey = getRecencyBucketKey(recencyAgeInDays);
					const recencyBucketIndex =
						recencyBucketIndexByKey.get(recencyBucketKey);
					if (recencyBucketIndex !== undefined) {
						recencyBuckets[recencyBucketIndex]!.partnersCount += 1;
					}

					return {
						partnerId: partner.id,
						partnerName: partner.name,
						partnerCompanyName: partner.companyName,
						status: partner.status,
						supervisors: partner.supervisors,
						salesCount: partnerSales.length,
						grossAmount: partnerGrossAmount,
						averageTicket: toAverageAmount(
							partnerGrossAmount,
							partnerSales.length,
						),
						commissionReceivedAmount: commissionTotals.income.paidAmount,
						commissionPendingAmount: commissionTotals.income.pendingAmount,
						commissionReceivableCanceledAmount:
							commissionTotals.income.canceledAmount,
						commissionPayablePaidAmount: commissionTotals.outcome.paidAmount,
						commissionPayablePendingAmount:
							commissionTotals.outcome.pendingAmount,
						commissionPayableCanceledAmount:
							commissionTotals.outcome.canceledAmount,
						netRevenueAmount: partnerNetRevenue,
						delinquentSalesCount: partnerDelinquentSalesCount,
						delinquentGrossAmount: partnerDelinquentGrossAmount,
						delinquencyRateByCountPct: toPercentage(
							partnerDelinquentSalesCount,
							partnerSales.length,
						),
						delinquencyRateByAmountPct: toPercentage(
							partnerDelinquentGrossAmount,
							partnerGrossAmount,
						),
						lastSaleDate,
						recencyLastSaleDate,
						salesBreakdown: partnerSalesBreakdown,
					} satisfies PartnerSummaryMetrics;
				});

				const producingPartners = partnerMetrics.filter(
					(partner) => partner.salesCount > 0,
				).length;
				const grossAmount = partnerMetrics.reduce(
					(sum, partner) => sum + partner.grossAmount,
					0,
				);
				const commissionReceivedAmount = partnerMetrics.reduce(
					(sum, partner) => sum + partner.commissionReceivedAmount,
					0,
				);
				const commissionPendingAmount = partnerMetrics.reduce(
					(sum, partner) => sum + partner.commissionPendingAmount,
					0,
				);
				const commissionReceivableCanceledAmount = partnerMetrics.reduce(
					(sum, partner) => sum + partner.commissionReceivableCanceledAmount,
					0,
				);
				const commissionPayablePaidAmount = partnerMetrics.reduce(
					(sum, partner) => sum + partner.commissionPayablePaidAmount,
					0,
				);
				const commissionPayablePendingAmount = partnerMetrics.reduce(
					(sum, partner) => sum + partner.commissionPayablePendingAmount,
					0,
				);
				const commissionPayableCanceledAmount = partnerMetrics.reduce(
					(sum, partner) => sum + partner.commissionPayableCanceledAmount,
					0,
				);
				const netRevenueAmount = partnerMetrics.reduce(
					(sum, partner) => sum + partner.netRevenueAmount,
					0,
				);
				const delinquentSalesCount = partnerMetrics.reduce(
					(sum, partner) => sum + partner.delinquentSalesCount,
					0,
				);
				const delinquentGrossAmount = partnerMetrics.reduce(
					(sum, partner) => sum + partner.delinquentGrossAmount,
					0,
				);

				const ranking = [...partnerMetrics]
					.sort(
						(left, right) =>
							right.grossAmount - left.grossAmount ||
							right.salesCount - left.salesCount ||
							left.partnerName.localeCompare(right.partnerName, "pt-BR"),
					)
					.map((partner) => ({
						partnerId: partner.partnerId,
						partnerName: partner.partnerName,
						partnerCompanyName: partner.partnerCompanyName,
						status: partner.status,
						supervisors: partner.supervisors,
						salesCount: partner.salesCount,
						grossAmount: partner.grossAmount,
						averageTicket: partner.averageTicket,
						commissionReceivedAmount: partner.commissionReceivedAmount,
						netRevenueAmount: partner.netRevenueAmount,
						delinquentSalesCount: partner.delinquentSalesCount,
						delinquentGrossAmount: partner.delinquentGrossAmount,
						delinquencyRateByCountPct: partner.delinquencyRateByCountPct,
						delinquencyRateByAmountPct: partner.delinquencyRateByAmountPct,
						lastSaleDate: partner.lastSaleDate,
						salesBreakdown: partner.salesBreakdown,
					}));
				const riskRanking = {
					items: [...partnerMetrics]
						.sort(
							(left, right) =>
								right.delinquentGrossAmount - left.delinquentGrossAmount ||
								right.delinquencyRateByAmountPct -
									left.delinquencyRateByAmountPct ||
								right.delinquentSalesCount - left.delinquentSalesCount ||
								left.partnerName.localeCompare(right.partnerName, "pt-BR"),
						)
						.map((partner) => ({
							partnerId: partner.partnerId,
							partnerName: partner.partnerName,
							partnerCompanyName: partner.partnerCompanyName,
							status: partner.status,
							supervisors: partner.supervisors,
							totalSales: partner.salesCount,
							grossAmount: partner.grossAmount,
							delinquentSalesCount: partner.delinquentSalesCount,
							delinquentGrossAmount: partner.delinquentGrossAmount,
							delinquencyRateByCountPct: partner.delinquencyRateByCountPct,
							delinquencyRateByAmountPct: partner.delinquencyRateByAmountPct,
							lastSaleDate: partner.recencyLastSaleDate,
						})),
				};

				const statusFunnelSummaryByStatus = new Map(
					statusFunnelRows.map((row) => [
						row.status,
						{
							salesCount: row._count._all,
							grossAmount: row._sum.totalAmount ?? 0,
						},
					]),
				);
				const statusFunnel = {
					items: PARTNER_DASHBOARD_FUNNEL_STATUSES.map((status) => {
						const summary = statusFunnelSummaryByStatus.get(status) ?? {
							salesCount: 0,
							grossAmount: 0,
						};
						return {
							status,
							label: getStatusLabel(status),
							salesCount: summary.salesCount,
							grossAmount: summary.grossAmount,
						};
					}),
				};

				const rankingWithSales = ranking.filter(
					(partner) => partner.salesCount > 0,
				);
				let cumulativeGrossAmount = 0;
				let cumulativeSalesCount = 0;
				const paretoTotalGrossAmount = rankingWithSales.reduce(
					(sum, partner) => sum + partner.grossAmount,
					0,
				);
				const paretoTotalSalesCount = rankingWithSales.reduce(
					(sum, partner) => sum + partner.salesCount,
					0,
				);
				const pareto = {
					items: rankingWithSales.map((partner) => {
						cumulativeGrossAmount += partner.grossAmount;
						cumulativeSalesCount += partner.salesCount;
						return {
							partnerId: partner.partnerId,
							partnerName: partner.partnerName,
							partnerCompanyName: partner.partnerCompanyName,
							salesCount: partner.salesCount,
							grossAmount: partner.grossAmount,
							cumulativeGrossAmount,
							cumulativeGrossPct: toPercentage(
								cumulativeGrossAmount,
								paretoTotalGrossAmount,
							),
							cumulativeSalesPct: toPercentage(
								cumulativeSalesCount,
								paretoTotalSalesCount,
							),
						};
					}),
				};
				const ticketByPartner = {
					items: [...rankingWithSales]
						.sort(
							(left, right) =>
								right.averageTicket - left.averageTicket ||
								right.grossAmount - left.grossAmount ||
								left.partnerName.localeCompare(right.partnerName, "pt-BR"),
						)
						.slice(0, PARTNER_DASHBOARD_TOP_LIST_LIMIT)
						.map((partner) => ({
							partnerId: partner.partnerId,
							partnerName: partner.partnerName,
							partnerCompanyName: partner.partnerCompanyName,
							salesCount: partner.salesCount,
							grossAmount: partner.grossAmount,
							averageTicket: partner.averageTicket,
						})),
				};
				const commissionBreakdown = {
					receivedAmount: commissionReceivedAmount,
					pendingAmount: commissionPendingAmount,
					canceledAmount: commissionReceivableCanceledAmount,
					payablePaidAmount: commissionPayablePaidAmount,
					payablePendingAmount: commissionPayablePendingAmount,
					payableCanceledAmount: commissionPayableCanceledAmount,
					netRevenueAmount,
					pendingByPartner: {
						items: [...partnerMetrics]
							.filter((partner) => partner.commissionPendingAmount > 0)
							.sort(
								(left, right) =>
									right.commissionPendingAmount -
										left.commissionPendingAmount ||
									right.grossAmount - left.grossAmount ||
									left.partnerName.localeCompare(right.partnerName, "pt-BR"),
							)
							.slice(0, PARTNER_DASHBOARD_TOP_LIST_LIMIT)
							.map((partner) => ({
								partnerId: partner.partnerId,
								partnerName: partner.partnerName,
								partnerCompanyName: partner.partnerCompanyName,
								status: partner.status,
								supervisors: partner.supervisors,
								salesCount: partner.salesCount,
								grossAmount: partner.grossAmount,
								pendingAmount: partner.commissionPendingAmount,
								lastSaleDate: partner.recencyLastSaleDate,
							})),
					},
				};

				return {
					period: {
						selected: {
							from: startDate,
							to: endDate,
						},
						inactiveMonths,
						inactiveRange: {
							from: inactivityStartDate,
							to: endDate,
						},
						timelineGranularity,
					},
					filters: {
						supervisors: filterSupervisors,
						partners: filterPartners,
					},
					summary: {
						totalPartners: filteredPartners.length,
						activePartners: filteredPartners.filter(
							(partner) => partner.status === "ACTIVE",
						).length,
						inactivePartners: filteredPartners.filter(
							(partner) => partner.status === "INACTIVE",
						).length,
						producingPartners,
						producingPartnersRatePct: toPercentage(
							producingPartners,
							filteredPartners.length,
						),
						partnersWithoutProduction: filteredPartners.filter(
							(partner) => !partnersWithRecentSales.has(partner.id),
						).length,
						totalSales: sales.length,
						grossAmount,
						averageTicket: toAverageAmount(grossAmount, sales.length),
						averageTicketPerProducingPartner: toAverageAmount(
							grossAmount,
							producingPartners,
						),
						commissionReceivedAmount,
						commissionPendingAmount,
						netRevenueAmount,
						delinquentSalesCount,
						delinquentGrossAmount,
						delinquencyRateByCountPct: toPercentage(
							delinquentSalesCount,
							sales.length,
						),
						delinquencyRateByAmountPct: toPercentage(
							delinquentGrossAmount,
							grossAmount,
						),
					},
					ranking,
					supervisorRanking,
					timeline,
					dynamicFieldBreakdown,
					productBreakdown,
					statusFunnel,
					pareto,
					ticketByPartner,
					productionHealthTimeline,
					commissionBreakdown,
					delinquencyBreakdown: {
						totalSales: delinquentSalesCount,
						preCancellation: {
							threshold: preCancellationThreshold,
							salesCount: preCancellationSalesCount,
							grossAmount: preCancellationGrossAmount,
						},
						buckets: toPublicDelinquencyBuckets(delinquencyBuckets),
					},
					recencyBreakdown: {
						buckets: recencyBuckets,
					},
					riskRanking,
				};
			},
		);
}
