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
	buildCommissionInstallmentsVisibilityWhere,
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
import {
	parseSaleDynamicFieldSchemaJson,
	parseSaleDynamicFieldValuesJson,
	type SaleDynamicFieldSchemaSnapshot,
} from "./sale-dynamic-fields";

const PARTNER_DASHBOARD_SALE_STATUSES = [
	SaleStatus.PENDING,
	SaleStatus.APPROVED,
	SaleStatus.COMPLETED,
] as const;
const PARTNER_DASHBOARD_FUNNEL_STATUSES = [
	SaleStatus.PENDING,
	SaleStatus.APPROVED,
	SaleStatus.COMPLETED,
	SaleStatus.CANCELED,
] as const;
const DAY_TIMELINE_MAX_RANGE_DAYS = 90;
const PARTNER_DASHBOARD_TOP_LIST_LIMIT = 10;
const DELINQUENCY_BUCKETS = [
	{ key: "RANGE_1_30", label: "1 a 30 dias", min: 0, max: 30 },
	{ key: "RANGE_31_60", label: "31 a 60 dias", min: 31, max: 60 },
	{ key: "RANGE_61_90", label: "61 a 90 dias", min: 61, max: 90 },
	{
		key: "RANGE_90_PLUS",
		label: "90+ dias",
		min: 91,
		max: Number.POSITIVE_INFINITY,
	},
] as const;
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
	dynamicFieldSchema: Prisma.JsonValue | null;
	dynamicFieldValues: Prisma.JsonValue | null;
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

function getDelinquencyBucketKey(ageInDays: number) {
	for (const bucket of DELINQUENCY_BUCKETS) {
		if (ageInDays >= bucket.min && ageInDays <= bucket.max) {
			return bucket.key;
		}
	}

	return null;
}

function buildEmptyDelinquencyBuckets() {
	return DELINQUENCY_BUCKETS.map((bucket) => ({
		key: bucket.key,
		label: bucket.label,
		salesCount: 0,
		grossAmount: 0,
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

	if (status === SaleStatus.APPROVED) {
		return "Aprovada";
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
					name: partner.name,
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
				const salesVisibilityWhere =
					buildSalesVisibilityWhere(visibilityContext);
				const commissionInstallmentsVisibilityWhere =
					buildCommissionInstallmentsVisibilityWhere(visibilityContext);
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
									dynamicFieldSchema: true,
									dynamicFieldValues: true,
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
				const [
					delinquencySummaryBySaleId,
					commissionInstallmentsInCompetencyRange,
				] = await Promise.all([
					loadSaleDelinquencySummaryBySaleIds(prisma, organization.id, saleIds),
					filteredPartnerIds.length > 0
						? prisma.saleCommissionInstallment.findMany({
								where: {
									AND: [
										{
											expectedPaymentDate: {
												gte: startDate,
												lte: endDate,
											},
										},
										{
											saleCommission: {
												sale: {
													organizationId: organization.id,
													status: {
														in: [...PARTNER_DASHBOARD_SALE_STATUSES],
													},
													responsibleType: SaleResponsibleType.PARTNER,
													responsibleId: {
														in: filteredPartnerIds,
													},
												},
											},
										},
										...(salesVisibilityWhere
											? [
													{
														saleCommission: {
															sale: salesVisibilityWhere,
														},
													},
												]
											: []),
										...(commissionInstallmentsVisibilityWhere
											? [commissionInstallmentsVisibilityWhere]
											: []),
									],
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

				const paidCommissionByPartnerId = new Map<
					string,
					{ income: number; outcome: number }
				>();
				const pendingIncomeByPartnerId = new Map<string, number>();
				for (const installment of commissionInstallmentsInCompetencyRange) {
					const partnerId = installment.saleCommission.sale.responsibleId;
					if (!partnerId) {
						continue;
					}

					if (installment.status === SaleCommissionInstallmentStatus.PAID) {
						const currentTotals = paidCommissionByPartnerId.get(partnerId) ?? {
							income: 0,
							outcome: 0,
						};
						if (installment.saleCommission.direction === "INCOME") {
							currentTotals.income += installment.amount;
						} else {
							currentTotals.outcome += installment.amount;
						}
						paidCommissionByPartnerId.set(partnerId, currentTotals);
						continue;
					}

					if (
						installment.status === SaleCommissionInstallmentStatus.PENDING &&
						installment.saleCommission.direction === "INCOME"
					) {
						const currentAmount = pendingIncomeByPartnerId.get(partnerId) ?? 0;
						pendingIncomeByPartnerId.set(
							partnerId,
							currentAmount + installment.amount,
						);
					}
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

					if (
						sale.status === SaleStatus.APPROVED ||
						sale.status === SaleStatus.COMPLETED
					) {
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
				const delinquencyBuckets = buildEmptyDelinquencyBuckets();
				const delinquencyBucketIndexByKey = new Map(
					delinquencyBuckets.map((bucket, index) => [bucket.key, index]),
				);
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

				const partnerMetrics = filteredPartners.map((partner) => {
					const partnerSales = salesByPartnerId.get(partner.id) ?? [];
					const partnerGrossAmount = partnerSales.reduce(
						(sum, sale) => sum + sale.totalAmount,
						0,
					);
					const paidCommissionTotals = paidCommissionByPartnerId.get(
						partner.id,
					) ?? {
						income: 0,
						outcome: 0,
					};
					const partnerPendingAmount =
						pendingIncomeByPartnerId.get(partner.id) ?? 0;
					const partnerNetRevenue =
						paidCommissionTotals.income - paidCommissionTotals.outcome;
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

						const oldestDueDate = delinquencySummary.oldestDueDate;
						if (!oldestDueDate) {
							continue;
						}

						const ageInDays = getUtcCalendarDayDifference(
							endDate,
							oldestDueDate,
						);
						const bucketKey = getDelinquencyBucketKey(ageInDays);
						if (!bucketKey) {
							continue;
						}

						const bucketIndex = delinquencyBucketIndexByKey.get(bucketKey);
						if (bucketIndex === undefined) {
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
						status: partner.status,
						supervisors: partner.supervisors,
						salesCount: partnerSales.length,
						grossAmount: partnerGrossAmount,
						averageTicket: toAverageAmount(
							partnerGrossAmount,
							partnerSales.length,
						),
						commissionReceivedAmount: paidCommissionTotals.income,
						commissionPendingAmount: partnerPendingAmount,
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
							salesCount: partner.salesCount,
							grossAmount: partner.grossAmount,
							averageTicket: partner.averageTicket,
						})),
				};
				const commissionBreakdown = {
					receivedAmount: commissionReceivedAmount,
					pendingAmount: commissionPendingAmount,
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
						buckets: delinquencyBuckets,
					},
					recencyBreakdown: {
						buckets: recencyBuckets,
					},
					riskRanking,
				};
			},
		);
}
