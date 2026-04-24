import {
	endOfMonth,
	format,
	parse,
	startOfMonth,
	subDays,
	subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "@tanstack/react-router";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from "recharts";
import {
	useEffect,
	useId,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import { useQueryState } from "nuqs";
import { LoadingReveal } from "@/components/loading-reveal";
import {
	Activity,
	ArrowRight,
	BadgeDollarSign,
	BriefcaseBusiness,
	ChevronDown,
	CircleDollarSign,
	Clock3,
	Funnel,
	Minus,
	RefreshCcw,
	ShieldAlert,
	ShoppingCart,
	TrendingUp,
	Users,
} from "lucide-react";
import { FilterPanel } from "@/components/filter-panel";
import { Button } from "@/components/ui/button";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	dashboardInactiveMonthsParser,
	dateFilterParser,
	dashboardViewParser,
	entityFilterParser,
	productBreakdownDepthParser,
} from "@/hooks/filters/parsers";
import { usePartnerSalesDashboard } from "@/hooks/sales";
import type { GetOrganizationsSlugSalesDashboardPartners200 } from "@/http/generated";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL } from "@/utils/format-amount";
import { getInitials } from "@/utils/get-initials";

const PARTNER_SALES_STATUS_META = {
	PENDING: {
		label: "Pendentes",
		color: "#f59e0b",
		className:
			"border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
	},
	APPROVED: {
		label: "Aprovadas",
		color: "#3b82f6",
		className:
			"border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
	},
	COMPLETED: {
		label: "Concluídas",
		color: "#10b981",
		className:
			"border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
	},
	CANCELED: {
		label: "Canceladas",
		color: "#ef4444",
		className:
			"border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
	},
} as const;

const PARTNER_COMMISSION_STATUS_META = {
	pending: {
		label: "Pendentes",
		color: "from-yellow-500 to-amber-400",
	},
	paid: {
		label: "Pagas",
		color: "from-emerald-500 to-green-400",
	},
	canceled: {
		label: "Canceladas",
		color: "from-rose-500 to-red-400",
	},
} as const;

const timelineChartConfig = {
	concludedAndProcessedAmount: {
		label: "Todas",
		color: "hsl(217 91% 60%)",
	},
	concludedAmount: {
		label: "Concluídas",
		color: "hsl(160 84% 39%)",
	},
	processedAmount: {
		label: "Processadas",
		color: "hsl(45 93% 47%)",
	},
	canceledAmount: {
		label: "Canceladas",
		color: "hsl(0 84% 60%)",
	},
} satisfies ChartConfig;

const statusFunnelChartConfig = {
	value: {
		label: "Vendas",
	},
	PENDING: {
		label: PARTNER_SALES_STATUS_META.PENDING.label,
		color: PARTNER_SALES_STATUS_META.PENDING.color,
	},
	APPROVED: {
		label: PARTNER_SALES_STATUS_META.APPROVED.label,
		color: PARTNER_SALES_STATUS_META.APPROVED.color,
	},
	COMPLETED: {
		label: PARTNER_SALES_STATUS_META.COMPLETED.label,
		color: PARTNER_SALES_STATUS_META.COMPLETED.color,
	},
	CANCELED: {
		label: PARTNER_SALES_STATUS_META.CANCELED.label,
		color: PARTNER_SALES_STATUS_META.CANCELED.color,
	},
} satisfies ChartConfig;

const breakdownPieChartConfig = {
	salesCount: {
		label: "Vendas",
		color: "hsl(221 83% 53%)",
	},
} satisfies ChartConfig;

const delinquencyChartConfig = {
	salesCount: {
		label: "Vendas inadimplentes",
		color: "hsl(0 72% 51%)",
	},
} satisfies ChartConfig;

type PartnerDashboardData = GetOrganizationsSlugSalesDashboardPartners200;
type PartnerFilterOption = PartnerDashboardData["filters"]["partners"][number];
type PartnerCommissionBreakdown =
	PartnerDashboardData["commissionBreakdown"] & {
		canceledAmount?: number;
		payablePaidAmount?: number;
		payablePendingAmount?: number;
		payableCanceledAmount?: number;
	};
type DashboardBreakdownItem =
	PartnerDashboardData["dynamicFieldBreakdown"]["items"][number];
type StatusFunnelItem = PartnerDashboardData["statusFunnel"]["items"][number];
type StatusFunnelKey = StatusFunnelItem["status"];
type PartnerDashboardIdentity = {
	partnerName: string;
	partnerCompanyName?: string | null;
};
type BreakdownPieDataItem = DashboardBreakdownItem & {
	quantityCount: number;
	sharePct: number;
	fill: string;
};
type StatusFunnelPieDataItem = StatusFunnelItem & {
	fill: string;
};
type DelinquencyPieDataItem =
	PartnerDashboardData["delinquencyBreakdown"]["buckets"][number] & {
		delinquencyCount: number;
		sharePct: number;
		fill: string;
	};
type PartnerDashboardDelinquencyBreakdown =
	PartnerDashboardData["delinquencyBreakdown"] & {
		preCancellation?: {
			threshold: number | null;
			salesCount: number;
			grossAmount: number;
		};
	};
type AvailableDynamicFieldOption =
	PartnerDashboardData["dynamicFieldBreakdown"]["availableFields"][number];
type PartnerSalesSharePieDataItem = PartnerDashboardData["ranking"][number] & {
	soldAmount: number;
	sharePct: number;
	fill: string;
};
type PartnerSalesSharePieLabelProps = {
	cx?: number;
	cy?: number;
	midAngle?: number;
	outerRadius?: number;
	fill?: string;
	payload?: PartnerSalesSharePieDataItem;
};
type BreakdownPieLabelProps = {
	cx?: number;
	cy?: number;
	midAngle?: number;
	outerRadius?: number;
	fill?: string;
	payload?: BreakdownPieDataItem;
};

type PartnerKpiCardProps = {
	title: string;
	value: string;
	subtitle: string;
	icon: typeof Users;
	toneClassName: string;
};

const TIMELINE_SERIES_OPTIONS = [
	{
		key: "concludedAndProcessedAmount",
		label: "Todas",
	},
	{
		key: "concludedAmount",
		label: "Concluídas",
	},
	{
		key: "processedAmount",
		label: "Processadas",
	},
	{
		key: "canceledAmount",
		label: "Canceladas",
	},
] as const;
type TimelineSeriesKey = (typeof TIMELINE_SERIES_OPTIONS)[number]["key"];

const BREAKDOWN_PIE_COLORS = [
	"#2563eb",
	"#10b981",
	"#f59e0b",
	"#f97316",
	"#8b5cf6",
	"#06b6d4",
	"#ef4444",
	"#84cc16",
] as const;
const DELINQUENCY_PIE_COLORS = [
	"#f87171",
	"#ef4444",
	"#dc2626",
	"#b91c1c",
] as const;
const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_FILTER_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function getDefaultEndDate() {
	return format(new Date(), "yyyy-MM-dd");
}

function getDefaultStartDate() {
	return format(subDays(new Date(), 89), "yyyy-MM-dd");
}

function getPreviousMonthDateRange(referenceDate: string) {
	const parsedReferenceDate = parse(referenceDate, "yyyy-MM-dd", new Date());
	const previousMonthDate = subMonths(parsedReferenceDate, 1);

	return {
		startDate: format(startOfMonth(previousMonthDate), "yyyy-MM-dd"),
		endDate: format(endOfMonth(previousMonthDate), "yyyy-MM-dd"),
	};
}

function parsePartnerIdsCsv(value: string | null | undefined) {
	if (!value) {
		return [];
	}

	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function isValidUuid(value: string | null | undefined): value is string {
	return Boolean(value && UUID_REGEX.test(value));
}

function isValidDateFilterInput(
	value: string | null | undefined,
): value is string {
	if (!value || !DATE_FILTER_REGEX.test(value)) {
		return false;
	}

	const parsedDate = parse(value, "yyyy-MM-dd", new Date());
	return (
		!Number.isNaN(parsedDate.getTime()) &&
		format(parsedDate, "yyyy-MM-dd") === value
	);
}

function serializePartnerIdsCsv(ids: string[]) {
	return Array.from(new Set(ids)).join(",");
}

function formatCount(value: number) {
	return new Intl.NumberFormat("pt-BR").format(value);
}

function formatAmountFromCents(value: number) {
	return formatCurrencyBRL(value / 100);
}

function formatSharePercentage(value: number) {
	return `${value.toLocaleString("pt-BR", {
		minimumFractionDigits: value % 1 === 0 ? 0 : 1,
		maximumFractionDigits: 1,
	})}%`;
}

function getPieSliceEmphasisProps(index: number, activeIndex: number | null) {
	const isActive = activeIndex === index;
	const isInactive = activeIndex !== null && !isActive;

	return {
		opacity: isInactive ? 0.38 : 1,
		stroke: isActive ? "rgba(255, 255, 255, 0.92)" : "transparent",
		strokeWidth: isActive ? 4 : 0,
		style: {
			cursor: "pointer",
			filter: isActive
				? "drop-shadow(0 8px 18px rgba(15, 23, 42, 0.18))"
				: "none",
			transition: "opacity 160ms ease, filter 160ms ease, stroke-width 160ms ease",
		},
	};
}

function getPartnerPrimaryName(partner: PartnerDashboardIdentity) {
	return partner.partnerCompanyName?.trim() || partner.partnerName;
}

function getPartnerSecondaryName(partner: PartnerDashboardIdentity) {
	const companyName = partner.partnerCompanyName?.trim();
	if (!companyName || companyName === partner.partnerName) {
		return null;
	}

	return partner.partnerName;
}

function buildBreakdownPieData(items: DashboardBreakdownItem[]) {
	const totalSales = items.reduce((sum, item) => sum + item.salesCount, 0);

	return items.map((item, index) => ({
		...item,
		quantityCount: item.salesCount,
		sharePct: totalSales > 0 ? (item.salesCount / totalSales) * 100 : 0,
		fill: BREAKDOWN_PIE_COLORS[index % BREAKDOWN_PIE_COLORS.length]!,
	})) satisfies BreakdownPieDataItem[];
}

function renderBreakdownPieLabel(props: BreakdownPieLabelProps) {
	const {
		cx = 0,
		cy = 0,
		midAngle = 0,
		outerRadius = 0,
		fill = "currentColor",
		payload,
	} = props;

	if (!payload) {
		return null;
	}

	const radians = (-midAngle * Math.PI) / 180;
	const explodedOffset = 8;
	const offsetX = Math.cos(radians) * explodedOffset;
	const offsetY = Math.sin(radians) * explodedOffset;
	const lineStartRadius = outerRadius + 2;
	const lineBreakRadius = outerRadius + 12;
	const textRadius = outerRadius + 24;
	const startX = cx + offsetX + Math.cos(radians) * lineStartRadius;
	const startY = cy + offsetY + Math.sin(radians) * lineStartRadius;
	const breakX = cx + offsetX + Math.cos(radians) * lineBreakRadius;
	const breakY = cy + offsetY + Math.sin(radians) * lineBreakRadius;
	const endX =
		cx +
		offsetX +
		Math.cos(radians) * textRadius +
		(Math.cos(radians) >= 0 ? 10 : -10);
	const endY = cy + offsetY + Math.sin(radians) * textRadius;
	const textAnchor = endX >= cx ? "start" : "end";

	return (
		<g>
			<path
				d={`M ${startX} ${startY} L ${breakX} ${breakY} L ${endX} ${endY}`}
				fill="none"
				stroke={fill}
				strokeWidth={1.5}
				strokeLinecap="round"
			/>
			<circle cx={startX} cy={startY} r={2.5} fill={fill} />
			<text
				x={endX}
				y={endY - 4}
				textAnchor={textAnchor}
				className="fill-foreground text-[11px] font-semibold"
			>
				{payload.label}
			</text>
			<text
				x={endX}
				y={endY + 12}
				textAnchor={textAnchor}
				className="fill-muted-foreground text-[10px]"
			>
				{formatCount(payload.quantityCount)} •{" "}
				{formatSharePercentage(payload.sharePct)}
			</text>
		</g>
	);
}

function buildPartnerSalesSharePieData(items: PartnerDashboardData["ranking"]) {
	const soldPartners = [...items]
		.filter((partner) => partner.grossAmount > 0)
		.sort(
			(left, right) =>
				right.grossAmount - left.grossAmount ||
				right.salesCount - left.salesCount ||
				getPartnerPrimaryName(left).localeCompare(
					getPartnerPrimaryName(right),
					"pt-BR",
				),
		);
	const totalSoldAmount = soldPartners.reduce(
		(total, partner) => total + partner.grossAmount,
		0,
	);

	return soldPartners.map((partner, index) => ({
		...partner,
		soldAmount: partner.grossAmount,
		sharePct:
			totalSoldAmount > 0 ? (partner.grossAmount / totalSoldAmount) * 100 : 0,
		fill: BREAKDOWN_PIE_COLORS[index % BREAKDOWN_PIE_COLORS.length]!,
	})) satisfies PartnerSalesSharePieDataItem[];
}

function renderPartnerSalesSharePieLabel(
	props: PartnerSalesSharePieLabelProps,
) {
	const {
		cx = 0,
		cy = 0,
		midAngle = 0,
		outerRadius = 0,
		fill = "currentColor",
		payload,
	} = props;

	if (!payload) {
		return null;
	}

	const radians = (-midAngle * Math.PI) / 180;
	const explodedOffset = 12;
	const offsetX = Math.cos(radians) * explodedOffset;
	const offsetY = Math.sin(radians) * explodedOffset;
	const lineStartRadius = outerRadius + 2;
	const lineBreakRadius = outerRadius + 16;
	const textRadius = outerRadius + 34;
	const startX = cx + offsetX + Math.cos(radians) * lineStartRadius;
	const startY = cy + offsetY + Math.sin(radians) * lineStartRadius;
	const breakX = cx + offsetX + Math.cos(radians) * lineBreakRadius;
	const breakY = cy + offsetY + Math.sin(radians) * lineBreakRadius;
	const endX =
		cx +
		offsetX +
		Math.cos(radians) * textRadius +
		(Math.cos(radians) >= 0 ? 16 : -16);
	const endY = cy + offsetY + Math.sin(radians) * textRadius;
	const textAnchor = endX >= cx ? "start" : "end";
	const primaryName = getPartnerPrimaryName(payload);

	return (
		<g>
			<path
				d={`M ${startX} ${startY} L ${breakX} ${breakY} L ${endX} ${endY}`}
				fill="none"
				stroke={fill}
				strokeWidth={1.5}
				strokeLinecap="round"
			/>
			<circle cx={startX} cy={startY} r={2.5} fill={fill} />
			<text
				x={endX}
				y={endY - 4}
				textAnchor={textAnchor}
				className="fill-foreground text-[11px] font-medium"
			>
				{primaryName}
			</text>
			<text
				x={endX}
				y={endY + 12}
				textAnchor={textAnchor}
				className="fill-muted-foreground text-[10px] font-medium"
			>
				{formatAmountFromCents(payload.soldAmount)}
			</text>
		</g>
	);
}

export function dedupeAvailableDynamicFields(
	availableFields: AvailableDynamicFieldOption[],
	selectedFieldId: string | null,
) {
	const uniqueFieldsByKey = new Map<string, AvailableDynamicFieldOption>();
	const seenFieldIds = new Set<string>();

	for (const field of availableFields) {
		if (seenFieldIds.has(field.fieldId)) {
			continue;
		}

		seenFieldIds.add(field.fieldId);
		const normalizedLabel = field.label.trim().toLocaleLowerCase("pt-BR");
		const dedupeKey = `${field.type}:${normalizedLabel}`;
		const existingField = uniqueFieldsByKey.get(dedupeKey);

		if (!existingField) {
			uniqueFieldsByKey.set(dedupeKey, field);
			continue;
		}

		if (selectedFieldId && field.fieldId === selectedFieldId) {
			uniqueFieldsByKey.set(dedupeKey, field);
		}
	}

	return Array.from(uniqueFieldsByKey.values());
}

function buildDelinquencyPieData(
	buckets: PartnerDashboardData["delinquencyBreakdown"]["buckets"],
) {
	const totalSales = buckets.reduce((sum, bucket) => sum + bucket.salesCount, 0);

	return buckets.map((bucket, index) => ({
		...bucket,
		delinquencyCount: bucket.salesCount,
		sharePct: totalSales > 0 ? (bucket.salesCount / totalSales) * 100 : 0,
		fill: DELINQUENCY_PIE_COLORS[index % DELINQUENCY_PIE_COLORS.length]!,
	})) satisfies DelinquencyPieDataItem[];
}

type DelinquencyPieLabelProps = {
	cx?: number;
	cy?: number;
	midAngle?: number;
	outerRadius?: number;
	fill?: string;
	payload?: DelinquencyPieDataItem;
};

function renderDelinquencyPieLabel(props: DelinquencyPieLabelProps) {
	const {
		cx = 0,
		cy = 0,
		midAngle = 0,
		outerRadius = 0,
		fill = "currentColor",
		payload,
	} = props;

	if (!payload) {
		return null;
	}

	const radians = (-midAngle * Math.PI) / 180;
	const explodedOffset = 12;
	const offsetX = Math.cos(radians) * explodedOffset;
	const offsetY = Math.sin(radians) * explodedOffset;
	const lineStartRadius = outerRadius + 2;
	const lineBreakRadius = outerRadius + 16;
	const textRadius = outerRadius + 34;
	const startX = cx + offsetX + Math.cos(radians) * lineStartRadius;
	const startY = cy + offsetY + Math.sin(radians) * lineStartRadius;
	const breakX = cx + offsetX + Math.cos(radians) * lineBreakRadius;
	const breakY = cy + offsetY + Math.sin(radians) * lineBreakRadius;
	const endX =
		cx +
		offsetX +
		Math.cos(radians) * textRadius +
		(Math.cos(radians) >= 0 ? 16 : -16);
	const endY = cy + offsetY + Math.sin(radians) * textRadius;
	const textAnchor = endX >= cx ? "start" : "end";

	return (
		<g>
			<path
				d={`M ${startX} ${startY} L ${breakX} ${breakY} L ${endX} ${endY}`}
				fill="none"
				stroke={fill}
				strokeWidth={1.5}
				strokeLinecap="round"
			/>
			<circle cx={startX} cy={startY} r={2.5} fill={fill} />
			<text
				x={endX}
				y={endY - 4}
				textAnchor={textAnchor}
				className="fill-foreground text-[11px] font-semibold"
			>
				{payload.label}
			</text>
			<text
				x={endX}
				y={endY + 12}
				textAnchor={textAnchor}
				className="fill-muted-foreground text-[10px]"
			>
				{formatCount(payload.delinquencyCount)} •{" "}
				{formatSharePercentage(payload.sharePct)}
			</text>
		</g>
	);
}

function PartnerKpiCard({
	title,
	value,
	subtitle,
	icon: Icon,
	toneClassName,
}: PartnerKpiCardProps) {
	return (
		<Card className="h-full w-full border-border/70">
			<CardContent className="flex items-start justify-between gap-4 p-5">
				<div className="space-y-1.5">
					<p className="text-sm text-muted-foreground">{title}</p>
					<p className="text-2xl font-semibold tracking-tight text-foreground">
						{value}
					</p>
					<p className="text-xs text-muted-foreground">{subtitle}</p>
				</div>
				<div className={cn("rounded-2xl p-3", toneClassName)}>
					<Icon className="size-5" />
				</div>
			</CardContent>
		</Card>
	);
}

function PartnerCompactMetric({
	label,
	value,
}: {
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-xl border bg-muted/20 p-3">
			<div className="text-xs text-muted-foreground">{label}</div>
			<div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
		</div>
	);
}

function PartnerMultiSelectFilter({
	options,
	selectedIds,
	onChange,
	disabled,
}: {
	options: PartnerFilterOption[];
	selectedIds: string[];
	onChange: (ids: string[]) => void;
	disabled?: boolean;
}) {
	const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
	const selectedPartners = useMemo(
		() => options.filter((option) => selectedIdSet.has(option.id)),
		[options, selectedIdSet],
	);
	const hasAllPartnersSelected =
		options.length > 0 && selectedPartners.length === options.length;
	const triggerLabel =
		selectedPartners.length === 0 || hasAllPartnersSelected
			? "Todos os parceiros"
			: selectedPartners.length === 1
				? selectedPartners[0]
					? getPartnerPrimaryName(selectedPartners[0])
					: "1 parceiro"
				: `${selectedPartners.length} parceiros`;

	function togglePartner(id: string, checked: boolean) {
		if (checked) {
			onChange([...selectedIds, id]);
			return;
		}

		onChange(selectedIds.filter((selectedId) => selectedId !== id));
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="outline"
					disabled={disabled}
					className="w-full justify-between rounded-full"
				>
					<span className="truncate">{triggerLabel}</span>
					<ArrowRight className="size-4 rotate-90 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-80">
				<DropdownMenuLabel>Parceiros</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{options.length === 0 ? (
					<DropdownMenuItem disabled>
						Nenhum parceiro disponível
					</DropdownMenuItem>
				) : (
					<>
						<DropdownMenuItem
							onSelect={(event) => {
								event.preventDefault();
								onChange([]);
							}}
						>
							Todos os parceiros
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						{options.map((option) => {
							const secondaryName = getPartnerSecondaryName(option);
							return (
								<DropdownMenuCheckboxItem
									key={option.id}
									checked={selectedIdSet.has(option.id)}
									onCheckedChange={(checked) =>
										togglePartner(option.id, Boolean(checked))
									}
								>
									<div className="flex flex-col gap-0.5">
										<span className="font-medium">
											{getPartnerPrimaryName(option)}
										</span>
										{secondaryName ? (
											<span className="text-xs text-muted-foreground">
												{secondaryName}
											</span>
										) : null}
										<span className="text-xs text-muted-foreground">
											{option.supervisors.length > 0
												? option.supervisors
														.map(
															(supervisor) =>
																supervisor.name ?? "Supervisor sem nome",
														)
														.join(", ")
												: "Sem supervisor"}
										</span>
									</div>
								</DropdownMenuCheckboxItem>
							);
						})}
					</>
				)}
				{selectedIds.length > 0 ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={(event) => {
								event.preventDefault();
								onChange([]);
							}}
						>
							Limpar seleção
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function TimelineSeriesSelectFilter({
	selectedKey,
	onChange,
}: {
	selectedKey: TimelineSeriesKey;
	onChange: (key: TimelineSeriesKey) => void;
}) {
	return (
		<Select
			value={selectedKey}
			onValueChange={(value) => onChange(value as TimelineSeriesKey)}
		>
			<SelectTrigger className="w-full rounded-full sm:w-[260px]">
				<SelectValue placeholder="Selecione uma série" />
			</SelectTrigger>
			<SelectContent>
				{TIMELINE_SERIES_OPTIONS.map((option) => (
					<SelectItem key={option.key} value={option.key}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function PartnerBreakdownPieCard({
	title,
	description,
	items,
	emptyMessage,
	headerAction,
	variant = "compact",
}: {
	title: string;
	description: string;
	items: DashboardBreakdownItem[];
	emptyMessage: string;
	headerAction?: ReactNode;
	variant?: "compact" | "regular";
}) {
	const [activeSliceIndex, setActiveSliceIndex] = useState<number | null>(null);
	const pieData = useMemo(() => buildBreakdownPieData(items), [items]);
	const isCompact = variant === "compact";
	const { totalSales, totalGrossAmount } = useMemo(() => {
		return {
			totalSales: pieData.reduce((sum, item) => sum + item.salesCount, 0),
			totalGrossAmount: pieData.reduce(
				(sum, item) => sum + item.grossAmount,
				0,
			),
		};
	}, [pieData]);

	return (
		<Card className="h-full w-full border-border/70">
			<CardHeader
				className={cn(
					isCompact ? "gap-2 pb-3" : "gap-3 pb-4",
					headerAction && "flex flex-row items-start justify-between",
				)}
			>
				<div className="min-w-0 flex-1 space-y-1.5">
					<CardTitle>{title}</CardTitle>
					<CardDescription>{description}</CardDescription>
				</div>
				{headerAction ? (
					<div className="ml-auto shrink-0 self-start">{headerAction}</div>
				) : null}
			</CardHeader>
			<CardContent className="pt-0">
				{pieData.length === 0 ? (
					<div
						className={cn(
							"flex items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center text-sm text-muted-foreground",
							isCompact ? "h-[150px] px-4" : "h-[176px] px-5",
						)}
					>
						{emptyMessage}
					</div>
				) : (
					<div className="space-y-4">
						<div
							className={cn(
								"relative mx-auto w-full",
								isCompact
									? "max-w-[320px] 2xl:max-w-[360px]"
									: "max-w-[360px] 2xl:max-w-[420px]",
							)}
						>
							<ChartContainer
								config={breakdownPieChartConfig}
								className={cn("w-full", isCompact ? "h-[260px]" : "h-[300px]")}
							>
								<PieChart
									margin={{
										top: 24,
										right: isCompact ? 72 : 84,
										bottom: 24,
										left: isCompact ? 72 : 84,
									}}
								>
									<ChartTooltip
										content={
											<ChartTooltipContent
												hideLabel
												formatter={(value, _name, item) => {
													const dataPoint =
														item.payload as BreakdownPieDataItem;
													return (
														<div className="flex w-full flex-col gap-1">
															<div className="font-medium text-foreground">
																{dataPoint.label}
															</div>
															<div className="flex items-center justify-between gap-3">
																<span className="text-muted-foreground">
																	Vendas
																</span>
																<span className="font-mono font-medium tabular-nums text-foreground">
																	{formatCount(Number(value))}
																</span>
															</div>
															<div className="flex items-center justify-between gap-3">
																<span className="text-muted-foreground">
																	Participação
																</span>
																<span className="font-mono font-medium tabular-nums text-foreground">
																	{formatSharePercentage(dataPoint.sharePct)}
																</span>
															</div>
															<div className="flex items-center justify-between gap-3">
																<span className="text-muted-foreground">
																	Produção
																</span>
																<span className="font-mono font-medium tabular-nums text-foreground">
																	{formatAmountFromCents(dataPoint.grossAmount)}
																</span>
															</div>
														</div>
													);
												}}
											/>
										}
									/>
									<Pie
										data={pieData}
										dataKey="quantityCount"
										nameKey="label"
										cx="50%"
										cy="48%"
										innerRadius={isCompact ? 44 : 50}
										outerRadius={isCompact ? 78 : 88}
										paddingAngle={3}
										labelLine={false}
										label={renderBreakdownPieLabel}
										activeIndex={activeSliceIndex ?? undefined}
										isAnimationActive={false}
										onMouseEnter={(_entry, index) => setActiveSliceIndex(index)}
										onMouseLeave={() => setActiveSliceIndex(null)}
									>
										{pieData.map((entry, index) => (
											<Cell
												key={`${entry.valueId}-${entry.fill}`}
												fill={entry.fill}
												{...getPieSliceEmphasisProps(
													index,
													activeSliceIndex,
												)}
											/>
										))}
									</Pie>
								</PieChart>
							</ChartContainer>
						</div>

						<div className="grid grid-cols-2 gap-2">
							<div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
								<div className="text-[11px] text-muted-foreground">
									Total vendas
								</div>
								<div className="text-sm font-semibold text-foreground">
									{formatCount(totalSales)}
								</div>
							</div>
							<div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-right">
								<div className="text-[11px] text-muted-foreground">
									Produção total
								</div>
								<div className="text-sm font-semibold text-foreground">
									{formatAmountFromCents(totalGrossAmount)}
								</div>
							</div>
						</div>

						<div
							className={cn(
								"space-y-2 overflow-y-auto pr-1",
								isCompact ? "max-h-[208px]" : "max-h-[224px]",
							)}
						>
							{pieData.map((item) => (
								<div
									key={item.valueId}
									className={cn(
										"rounded-xl border border-border/70 bg-background/80",
										isCompact ? "px-2.5 py-1.5" : "px-3 py-2",
									)}
								>
									<div className="flex items-center justify-between gap-2">
										<div className="flex min-w-0 items-center gap-2">
											<span
												className="size-2.5 shrink-0 rounded-full"
												style={{ backgroundColor: item.fill }}
											/>
											<span
												className={cn(
													"truncate text-foreground",
													isCompact ? "text-xs" : "text-xs sm:text-sm",
												)}
											>
												{item.label}
											</span>
										</div>
										<div
											className={cn(
												"font-mono font-medium tabular-nums text-foreground",
												isCompact ? "text-xs" : "text-xs sm:text-sm",
											)}
										>
											{formatCount(item.quantityCount)}
										</div>
									</div>
									<div className="mt-1 text-right text-xs text-muted-foreground">
										{formatSharePercentage(item.sharePct)}
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function PartnerSalesSharePieCard({
	items,
}: {
	items: PartnerDashboardData["ranking"];
}) {
	const [activeSliceIndex, setActiveSliceIndex] = useState<number | null>(null);
	const pieData = useMemo(() => buildPartnerSalesSharePieData(items), [items]);

	return (
		<Card className="h-full border-border/70">
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center gap-2">
					<CircleDollarSign className="size-4 text-muted-foreground" />
					Participação por parceiro
				</CardTitle>
				<CardDescription>
					Distribuição do valor vendido por parceiro no período filtrado.
				</CardDescription>
			</CardHeader>
			<CardContent className="pt-0">
				{pieData.length === 0 ? (
					<div className="flex h-[340px] items-center justify-center rounded-xl border border-dashed bg-muted/20 px-5 text-center text-sm text-muted-foreground">
						Nenhum parceiro com valor vendido no período selecionado.
					</div>
				) : (
					<div className="mx-auto w-full max-w-[460px]">
						<div className="mx-auto w-full max-w-[420px] 2xl:max-w-[480px]">
							<ChartContainer
								config={breakdownPieChartConfig}
								className="h-[340px] w-full"
							>
								<PieChart margin={{ top: 24, right: 56, bottom: 24, left: 56 }}>
									<ChartTooltip
										content={
											<ChartTooltipContent
												hideLabel
												formatter={(_value, _name, item) => {
													const dataPoint =
														item.payload as PartnerSalesSharePieDataItem;
													const primaryName = getPartnerPrimaryName(dataPoint);
													const secondaryName =
														getPartnerSecondaryName(dataPoint);
													return (
														<div className="flex w-full flex-col gap-1">
															<div className="font-medium text-foreground">
																{primaryName}
															</div>
															{secondaryName ? (
																<div className="text-xs text-muted-foreground">
																	{secondaryName}
																</div>
															) : null}
															<div className="flex items-center justify-between gap-3">
																<span className="text-muted-foreground">
																	Valor vendido
																</span>
																<span className="font-mono font-medium tabular-nums text-foreground">
																	{formatAmountFromCents(dataPoint.soldAmount)}
																</span>
															</div>
															<div className="flex items-center justify-between gap-3">
																<span className="text-muted-foreground">
																	Participação
																</span>
																<span className="font-mono font-medium tabular-nums text-foreground">
																	{formatSharePercentage(dataPoint.sharePct)}
																</span>
															</div>
														</div>
													);
												}}
											/>
										}
									/>
									<Pie
										data={pieData}
										dataKey="soldAmount"
										nameKey="partnerName"
										cx="50%"
										cy="48%"
										innerRadius={44}
										outerRadius={78}
										paddingAngle={3}
										labelLine={false}
										label={renderPartnerSalesSharePieLabel}
										activeIndex={activeSliceIndex ?? undefined}
										isAnimationActive={false}
										onMouseEnter={(_entry, index) => setActiveSliceIndex(index)}
										onMouseLeave={() => setActiveSliceIndex(null)}
									>
										{pieData.map((entry, index) => (
											<Cell
												key={`${entry.partnerId}-${entry.fill}`}
												fill={entry.fill}
												{...getPieSliceEmphasisProps(
													index,
													activeSliceIndex,
												)}
											/>
										))}
									</Pie>
								</PieChart>
							</ChartContainer>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function PartnerRankingSection({
	items,
}: {
	items: PartnerDashboardData["ranking"];
}) {
	const soldPartners = useMemo(
		() =>
			[...items]
				.filter((partner) => partner.salesCount > 0)
				.sort(
					(left, right) =>
						right.grossAmount - left.grossAmount ||
						right.salesCount - left.salesCount ||
						getPartnerPrimaryName(left).localeCompare(
							getPartnerPrimaryName(right),
							"pt-BR",
						),
				),
		[items],
	);
	const topThree = useMemo(() => soldPartners.slice(0, 3), [soldPartners]);
	const totalProductionCount = useMemo(
		() =>
			soldPartners.reduce(
				(total, partner) =>
					total +
					partner.salesBreakdown.concluded.salesCount +
					partner.salesBreakdown.pending.salesCount,
				0,
			),
		[soldPartners],
	);

	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Activity className="size-4 text-muted-foreground" />
					Ranking de parceiros
				</CardTitle>
				<CardDescription>
					Top 3 ao lado da lista completa de produção.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{soldPartners.length === 0 ? (
					<div className="rounded-xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
						Nenhum parceiro com venda para o período selecionado.
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,420px)_1px_minmax(0,1fr)] xl:items-stretch">
						<div className="flex h-full w-full max-w-[420px] justify-self-center xl:justify-self-start xl:pr-5">
							<div className="grid h-full w-full grid-cols-3 items-end gap-1">
								{[
									{
										rank: 2,
										partner: topThree[1] ?? null,
										pedestalClassName: "h-18",
									},
									{
										rank: 1,
										partner: topThree[0] ?? null,
										pedestalClassName: "h-28",
									},
									{
										rank: 3,
										partner: topThree[2] ?? null,
										pedestalClassName: "h-14",
									},
								].map((slot) => {
									const partner = slot.partner;
									const pedestalGradientByRank = {
										1: "bg-gradient-to-t from-emerald-500/85 to-green-500/70 dark:from-emerald-400/80 dark:to-green-400/65",
										2: "bg-gradient-to-t from-cyan-500/85 to-indigo-500/70 dark:from-cyan-400/80 dark:to-indigo-400/65",
										3: "bg-gradient-to-t from-amber-500/80 to-amber-400/55 dark:from-amber-400/75 dark:to-amber-300/50",
									} as const;
									const pedestalLabelByRank = {
										1: "text-primary-foreground",
										2: "text-primary-foreground",
										3: "text-amber-900 dark:text-amber-100",
									} as const;
									const avatarGradientByRank = {
										1: "bg-gradient-to-br from-emerald-500 to-green-500",
										2: "bg-gradient-to-br from-cyan-500 to-indigo-500",
										3: "bg-gradient-to-br from-amber-500/60 to-amber-400/30 dark:from-amber-400/60 dark:to-amber-300/30",
									} as const;
									const avatarLabelByRank = {
										1: "text-primary-foreground",
										2: "text-primary-foreground",
										3: "text-amber-900 dark:text-amber-100",
									} as const;
									const pedestalGradientClass =
										pedestalGradientByRank[slot.rank as 1 | 2 | 3];
									const pedestalLabelClass =
										pedestalLabelByRank[slot.rank as 1 | 2 | 3];
									const avatarGradientClass =
										avatarGradientByRank[slot.rank as 1 | 2 | 3];
									const avatarLabelClass =
										avatarLabelByRank[slot.rank as 1 | 2 | 3];

									if (!partner) {
										return (
											<div
												key={`podium-empty-${slot.rank}`}
												className="flex flex-col"
											>
												<div
													className={cn(
														"relative flex items-center justify-center rounded-t-2xl",
														pedestalGradientClass,
														slot.pedestalClassName,
													)}
												>
													<span
														className={cn(
															"font-bungee text-base font-black tabular-nums tracking-wide",
															pedestalLabelClass,
														)}
													>
														{slot.rank}
													</span>
												</div>
											</div>
										);
									}

									const totalSoldAmount =
										partner.salesBreakdown.concluded.grossAmount +
										partner.salesBreakdown.pending.grossAmount;
									const totalSoldCount =
										partner.salesBreakdown.concluded.salesCount +
										partner.salesBreakdown.pending.salesCount;
									const productionShare =
										totalProductionCount > 0
											? (totalSoldCount / totalProductionCount) * 100
											: 0;
									const primaryName = getPartnerPrimaryName(partner);
									const secondaryName = getPartnerSecondaryName(partner);

									return (
										<Tooltip key={partner.partnerId}>
											<TooltipTrigger asChild>
												<button
													type="button"
													className="group flex h-full w-full cursor-help flex-col justify-end rounded-t-2xl text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
													aria-label={`Detalhes do parceiro ${primaryName} na posição ${slot.rank}`}
												>
													<div className="flex min-h-[140px] flex-col justify-end rounded-t-2xl px-2 pb-2 pt-1 text-center transition-colors duration-200 group-hover:bg-muted/35">
														<div className="relative mx-auto">
															<Avatar className="size-13 border-2 border-background shadow-sm transition-transform duration-200 group-hover:scale-[1.04]">
																<AvatarFallback
																	className={cn(
																		"text-sm font-semibold transition-[filter] duration-200 group-hover:brightness-110",
																		avatarGradientClass,
																		avatarLabelClass,
																	)}
																>
																	{getInitials(primaryName)}
																</AvatarFallback>
															</Avatar>
														</div>

														<div className="mt-1 min-h-[36px] px-1 text-center leading-tight">
															<div className="break-words text-[11px] font-semibold text-foreground sm:text-[12px]">
																{primaryName}
															</div>
															{secondaryName ? (
																<div className="mt-0.5 hidden break-words text-[10px] text-muted-foreground sm:block">
																	{secondaryName}
																</div>
															) : null}
														</div>

														<div className="mt-16 -mx-2 w-[calc(100%+1rem)] text-center font-mono text-[11px] font-medium leading-tight tracking-tight text-foreground sm:text-[13px]">
															<span className="block w-full truncate px-1 tabular-nums">
																{formatAmountFromCents(totalSoldAmount)}
															</span>
														</div>
													</div>
													<div
														className={cn(
															"relative flex items-center justify-center rounded-t-2xl transition-all duration-200 group-hover:brightness-110 group-hover:saturate-150 group-hover:shadow-lg",
															pedestalGradientClass,
															slot.pedestalClassName,
														)}
													>
														<span
															className={cn(
																"font-bungee text-base font-black tabular-nums tracking-wide",
																pedestalLabelClass,
															)}
														>
															{slot.rank}
														</span>
													</div>
												</button>
											</TooltipTrigger>
											<TooltipContent
												side="top"
												sideOffset={10}
												className="min-w-[220px] space-y-1.5"
											>
												<div className="text-xs font-semibold">
													#{slot.rank} {primaryName}
												</div>
												{secondaryName ? (
													<div className="text-[11px] text-background/80">
														{secondaryName}
													</div>
												) : null}
												<div className="flex items-center justify-between gap-3">
													<span className="text-background/80">
														Produção total
													</span>
													<span className="font-mono font-medium tabular-nums">
														{formatAmountFromCents(totalSoldAmount)}
													</span>
												</div>
												<div className="flex items-center justify-between gap-3">
													<span className="text-background/80">Vendas</span>
													<span className="font-mono font-medium tabular-nums">
														{totalSoldCount}
													</span>
												</div>
												<div className="flex items-center justify-between gap-3">
													<span className="text-background/80">
														Participação
													</span>
													<span className="font-mono font-medium tabular-nums">
														{formatSharePercentage(productionShare)}
													</span>
												</div>
												<div className="flex items-center justify-between gap-3">
													<span className="text-background/80">
														Concluídas
													</span>
													<span className="font-mono font-medium tabular-nums">
														{formatAmountFromCents(
															partner.salesBreakdown.concluded.grossAmount,
														)}
													</span>
												</div>
												<div className="flex items-center justify-between gap-3">
													<span className="text-background/80">
														Processando
													</span>
													<span className="font-mono font-medium tabular-nums">
														{formatAmountFromCents(
															partner.salesBreakdown.pending.grossAmount,
														)}
													</span>
												</div>
												<div className="flex items-center justify-between gap-3">
													<span className="text-background/80">
														Canceladas
													</span>
													<span className="font-mono font-medium tabular-nums">
														{formatAmountFromCents(
															partner.salesBreakdown.canceled.grossAmount,
														)}
													</span>
												</div>
											</TooltipContent>
										</Tooltip>
									);
								})}
							</div>
						</div>
						<Separator className="xl:hidden" />
						<Separator
							orientation="vertical"
							className="hidden xl:block xl:self-stretch"
						/>

						<div className="rounded-md p-2 sm:p-3">
							<ScrollArea className="h-[19rem] pr-2 sm:h-[20.5rem]">
								<Table className="table-fixed">
									{soldPartners.map((partner, index) => {
										const rank = index + 1;
										const productionAmount =
											partner.salesBreakdown.concluded.grossAmount +
											partner.salesBreakdown.pending.grossAmount;
										const productionCount =
											partner.salesBreakdown.concluded.salesCount +
											partner.salesBreakdown.pending.salesCount;
										const productionHasValue =
											productionAmount > 0 || productionCount > 0;
										const productionShare =
											totalProductionCount > 0
												? (productionCount / totalProductionCount) * 100
												: 0;
										const productionShareWidth = Math.min(
											Math.max(productionShare, 0),
											100,
										);
										const primaryName = getPartnerPrimaryName(partner);
										const secondaryName = getPartnerSecondaryName(partner);
										return (
											<TableBody
												key={partner.partnerId}
												className="group/ranking [&_tr]:border-0"
											>
												<TableRow className="border-0 hover:bg-transparent">
														<TableCell className="w-10 whitespace-nowrap pb-1 pl-2 pr-2 pt-2 text-left align-middle">
															<span className="inline-flex h-8 items-center font-mono font-medium leading-none tabular-nums text-foreground transition-colors group-hover/ranking:text-emerald-600 dark:group-hover/ranking:text-emerald-400">
																{String(rank).padStart(2, "0")}
															</span>
														</TableCell>
														<TableCell className="pb-1 pl-2 pr-3 pt-2">
															<div className="flex min-w-0 items-center gap-2">
																<Avatar className="size-8 border border-border/70 transition-all duration-200 group-hover/ranking:border-emerald-400/60 group-hover/ranking:shadow-sm">
																	<AvatarFallback className="text-[11px] font-medium transition-colors group-hover/ranking:bg-emerald-500/10 group-hover/ranking:text-emerald-700 dark:group-hover/ranking:text-emerald-300">
																		{getInitials(primaryName)}
																	</AvatarFallback>
																</Avatar>
																<div className="min-w-0">
																	<div className="truncate font-medium text-foreground transition-colors group-hover/ranking:text-emerald-700 dark:group-hover/ranking:text-emerald-300">
																		{primaryName}
																	</div>
																	{secondaryName ? (
																		<div className="truncate text-xs text-muted-foreground">
																			{secondaryName}
																		</div>
																	) : null}
																</div>
															</div>
														</TableCell>
														<TableCell
															className={cn(
																"w-[8.5rem] px-2 pb-1 pt-2 text-right font-mono text-[13px] tabular-nums transition-colors sm:text-sm",
																productionHasValue
																	? "font-semibold text-foreground group-hover/ranking:text-emerald-700 dark:group-hover/ranking:text-emerald-300"
																	: "font-normal text-muted-foreground",
															)}
														>
															<div className="text-right leading-none">
																{formatAmountFromCents(productionAmount)}
															</div>
														</TableCell>
												</TableRow>
												<TableRow className="border-0 hover:bg-transparent">
														<TableCell className="py-0 pl-2 pr-1" />
														<TableCell colSpan={2} className="px-3 pb-2 pt-0">
															<div className="flex items-center gap-2">
																<Tooltip>
																	<TooltipTrigger asChild>
																		<button
																			type="button"
																			className="block w-full flex-1 cursor-help rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
																			aria-label={`Detalhes de produção de ${primaryName}`}
																		>
																			<div className="h-1.5 overflow-hidden rounded-full bg-muted transition-all duration-200 group-hover/ranking:h-2 group-hover/ranking:bg-emerald-500/10">
																				<div
																					className={cn(
																						"h-full rounded-full transition-[width,filter] duration-200 group-hover/ranking:brightness-110 group-hover/ranking:saturate-150",
																						productionHasValue
																							? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-400"
																							: "bg-muted-foreground/30",
																					)}
																					style={{
																						width: `${productionShareWidth}%`,
																					}}
																				/>
																			</div>
																		</button>
																	</TooltipTrigger>
																	<TooltipContent
																		side="top"
																		sideOffset={8}
																		className="min-w-[220px] space-y-1.5"
																	>
																		<div className="text-xs font-semibold">
																			{primaryName}
																		</div>
																		{secondaryName ? (
																			<div className="text-[11px] text-background/80">
																				{secondaryName}
																			</div>
																		) : null}
																		<div className="flex items-center justify-between gap-3">
																			<span className="text-background/80">
																				Concluídas
																			</span>
																			<span className="font-mono font-medium tabular-nums">
																				{formatAmountFromCents(
																					partner.salesBreakdown.concluded
																						.grossAmount,
																				)}
																			</span>
																		</div>
																		<div className="flex items-center justify-between gap-3">
																			<span className="text-background/80">
																				Processando
																			</span>
																			<span className="font-mono font-medium tabular-nums">
																				{formatAmountFromCents(
																					partner.salesBreakdown.pending
																						.grossAmount,
																				)}
																			</span>
																		</div>
																		<div className="flex items-center justify-between gap-3">
																			<span className="text-background/80">
																				Canceladas
																			</span>
																			<span className="font-mono font-medium tabular-nums">
																				{formatAmountFromCents(
																					partner.salesBreakdown.canceled
																						.grossAmount,
																				)}
																			</span>
																		</div>
																	</TooltipContent>
																</Tooltip>
																{productionShare >= 100 ? (
																	<span className="inline-flex w-[4.5rem] shrink-0 items-center justify-end gap-1 text-[11px] font-semibold tabular-nums text-emerald-600 transition-colors group-hover/ranking:text-emerald-700 dark:text-emerald-400 dark:group-hover/ranking:text-emerald-300">
																		<TrendingUp className="size-3" />
																		{formatSharePercentage(productionShare)}
																	</span>
																) : (
																	<span className="inline-flex w-[4.5rem] shrink-0 items-center justify-end gap-1 text-[11px] font-semibold tabular-nums text-amber-600 transition-colors group-hover/ranking:text-amber-700 dark:text-amber-400 dark:group-hover/ranking:text-amber-300">
																		<Minus className="size-3" />
																		{formatSharePercentage(productionShare)}
																	</span>
																)}
															</div>
														</TableCell>
												</TableRow>
											</TableBody>
											);
										})}
								</Table>
							</ScrollArea>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function SupervisorRankingSection({
	items,
	canceledByPartnerId,
	hasPreviousMonthCanceledData,
}: {
	items: PartnerDashboardData["ranking"];
	canceledByPartnerId: Record<
		string,
		{
			grossAmount: number;
			salesCount: number;
		}
	>;
	hasPreviousMonthCanceledData: boolean;
}) {
	const [openSupervisors, setOpenSupervisors] = useState<
		Record<string, boolean>
	>({});

	const supervisors = useMemo(() => {
		type AggregatedSupervisor = {
			supervisorId: string;
			supervisorName: string;
			partnersCount: number;
			salesCount: number;
			grossAmount: number;
			partners: PartnerDashboardData["ranking"];
		};

		const bySupervisor = new Map<string, AggregatedSupervisor>();

		for (const partner of items) {
			const concludedAmount = partner.salesBreakdown.concluded.grossAmount;
			const pendingAmount = partner.salesBreakdown.pending.grossAmount;
			const canceledAmount = partner.salesBreakdown.canceled.grossAmount;
			const concludedCount = partner.salesBreakdown.concluded.salesCount;
			const pendingCount = partner.salesBreakdown.pending.salesCount;
			const canceledCount = partner.salesBreakdown.canceled.salesCount;
			const totalTrackedAmount =
				concludedAmount + pendingAmount + canceledAmount;
			const totalTrackedCount = concludedCount + pendingCount + canceledCount;

			const partnerSupervisors =
				partner.supervisors.length > 0
					? partner.supervisors
					: [{ id: "UNASSIGNED", name: "Sem supervisor" }];

			for (const supervisor of partnerSupervisors) {
				const supervisorId = supervisor.id;
				const supervisorName = supervisor.name?.trim() || "Sem supervisor";
				const current = bySupervisor.get(supervisorId);

				if (!current) {
					bySupervisor.set(supervisorId, {
						supervisorId,
						supervisorName,
						partnersCount: 1,
						salesCount: totalTrackedCount,
						grossAmount: totalTrackedAmount,
						partners: [partner],
					});
					continue;
				}

				current.partnersCount += 1;
				current.salesCount += totalTrackedCount;
				current.grossAmount += totalTrackedAmount;
				current.partners.push(partner);
			}
		}

		return [...bySupervisor.values()].sort(
			(left, right) =>
				right.grossAmount - left.grossAmount ||
				right.salesCount - left.salesCount ||
				left.supervisorName.localeCompare(right.supervisorName, "pt-BR"),
		);
	}, [items]);
	const totalSupervisorsGrossAmount = useMemo(
		() =>
			supervisors.reduce(
				(total, supervisor) => total + supervisor.grossAmount,
				0,
			),
		[supervisors],
	);

	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<BriefcaseBusiness className="size-4 text-muted-foreground" />
					Ranking de supervisores
				</CardTitle>
				<CardDescription>
					Produção agregada por supervisor no período filtrado, com canceladas
					do mês anterior.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{supervisors.length === 0 ? (
					<div className="rounded-xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
						Nenhum supervisor com venda no período filtrado.
					</div>
				) : (
					<div className="space-y-2">
						{supervisors.map((supervisor, index) => {
							const isOpen = openSupervisors[supervisor.supervisorId] ?? false;
							const supervisorHasValue =
								supervisor.grossAmount > 0 || supervisor.salesCount > 0;
							const supervisorShare =
								totalSupervisorsGrossAmount > 0
									? (supervisor.grossAmount / totalSupervisorsGrossAmount) * 100
									: 0;
							const supervisorShareWidth = Math.min(
								Math.max(supervisorShare, 0),
								100,
							);
							const partners = [...supervisor.partners].sort(
								(left, right) =>
									right.salesBreakdown.concluded.grossAmount +
										right.salesBreakdown.pending.grossAmount +
										right.salesBreakdown.canceled.grossAmount -
										(left.salesBreakdown.concluded.grossAmount +
											left.salesBreakdown.pending.grossAmount +
											left.salesBreakdown.canceled.grossAmount) ||
									right.salesBreakdown.concluded.salesCount +
										right.salesBreakdown.pending.salesCount +
										right.salesBreakdown.canceled.salesCount -
										(left.salesBreakdown.concluded.salesCount +
											left.salesBreakdown.pending.salesCount +
											left.salesBreakdown.canceled.salesCount) ||
									getPartnerPrimaryName(left).localeCompare(
										getPartnerPrimaryName(right),
										"pt-BR",
									),
							);
							return (
								<Collapsible
									key={supervisor.supervisorId}
									open={isOpen}
									onOpenChange={(nextOpen) =>
										setOpenSupervisors((previousState) => ({
											...previousState,
											[supervisor.supervisorId]: nextOpen,
										}))
									}
								>
									<div className="overflow-hidden rounded-md border border-border/70 bg-background/80">
										<CollapsibleTrigger className="w-full cursor-pointer px-3 py-2 text-left hover:bg-muted/20">
											<div className="space-y-0.5">
												<div className="flex items-center gap-2 pb-1">
													<span className="inline-flex h-8 w-10 items-center font-mono font-medium leading-none tabular-nums text-foreground">
														{String(index + 1).padStart(2, "0")}
													</span>
													<div className="flex min-w-0 flex-1 items-center gap-2">
														<Avatar className="size-8 border border-border/70">
															<AvatarFallback className="text-[11px] font-medium">
																{getInitials(supervisor.supervisorName)}
															</AvatarFallback>
														</Avatar>
														<span className="truncate font-medium text-foreground">
															{supervisor.supervisorName}
														</span>
														<ChevronDown
															className={cn(
																"size-4 text-muted-foreground transition-transform",
																isOpen && "rotate-180",
															)}
														/>
													</div>
													<div className="shrink-0 pl-4 text-right sm:pl-6">
														<div className="font-mono text-sm font-semibold tabular-nums text-foreground">
															{formatAmountFromCents(supervisor.grossAmount)}
														</div>
													</div>
												</div>
												<div className="flex items-center gap-2 pl-10">
													<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
														<div
															className={cn(
																"h-full rounded-full transition-[width]",
																supervisorHasValue
																	? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-400"
																	: "bg-muted-foreground/30",
															)}
															style={{ width: `${supervisorShareWidth}%` }}
														/>
													</div>
													{supervisorShare >= 100 ? (
														<span className="inline-flex w-[4.5rem] items-center justify-end gap-1 text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
															<TrendingUp className="size-3" />
															{formatSharePercentage(supervisorShare)}
														</span>
													) : (
														<span className="inline-flex w-[4.5rem] items-center justify-end gap-1 text-[11px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
															<Minus className="size-3" />
															{formatSharePercentage(supervisorShare)}
														</span>
													)}
												</div>
											</div>
										</CollapsibleTrigger>
										<CollapsibleContent className="border-t border-border/70 bg-muted/10">
											<ScrollArea className="max-h-[17.5rem] w-full">
												<div className="min-w-[860px] p-2">
													<Table>
														<TableHeader className="[&_tr]:border-0">
															<TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
																<TableHead className="px-3 text-xs font-medium text-muted-foreground">
																	Parceiro
																</TableHead>
																<TableHead className="px-3 text-right text-xs font-medium text-muted-foreground">
																	Concluídas (R$ + qtd)
																</TableHead>
																<TableHead className="px-3 text-right text-xs font-medium text-muted-foreground">
																	Em processamento (R$ + qtd)
																</TableHead>
																<TableHead className="px-3 text-right text-xs font-medium text-muted-foreground">
																	Inadimplentes (R$ + qtd)
																</TableHead>
																<TableHead className="px-3 text-right text-xs font-medium text-muted-foreground">
																	Canceladas do mês passado (R$ + qtd)
																</TableHead>
															</TableRow>
														</TableHeader>
														<TableBody className="[&_tr]:border-0">
															{partners.map((partner) => {
															const canceledMetrics =
																canceledByPartnerId[partner.partnerId] ??
																(hasPreviousMonthCanceledData
																	? {
																			grossAmount: 0,
																			salesCount: 0,
																		}
																	: partner.salesBreakdown.canceled);
															const concludedHasValue =
																partner.salesBreakdown.concluded.grossAmount >
																	0 ||
																partner.salesBreakdown.concluded.salesCount > 0;
															const pendingHasValue =
																partner.salesBreakdown.pending.grossAmount >
																	0 ||
																partner.salesBreakdown.pending.salesCount > 0;
															const delinquentHasValue =
																partner.delinquentGrossAmount > 0 ||
																partner.delinquentSalesCount > 0;
															const canceledHasValue =
																canceledMetrics.grossAmount > 0 ||
																canceledMetrics.salesCount > 0;
															const primaryName =
																getPartnerPrimaryName(partner);
															const secondaryName =
																getPartnerSecondaryName(partner);

															return (
																	<TableRow
																		key={partner.partnerId}
																		className="bg-transparent hover:bg-muted/20"
																	>
																	<TableCell className="px-3 py-3">
																		<div className="flex min-w-0 items-center gap-3">
																			<Avatar className="size-7 border border-border/70">
																				<AvatarFallback className="text-[10px] font-medium">
																					{getInitials(primaryName)}
																				</AvatarFallback>
																			</Avatar>
																			<div className="min-w-0">
																				<div className="truncate font-medium text-foreground">
																					{primaryName}
																				</div>
																				{secondaryName ? (
																					<div className="truncate text-xs text-muted-foreground">
																						{secondaryName}
																					</div>
																				) : null}
																			</div>
																		</div>
																	</TableCell>
																	<TableCell
																		className={cn(
																			"px-3 py-3 text-right font-mono tabular-nums",
																			concludedHasValue
																				? "font-semibold text-foreground"
																				: "font-normal text-muted-foreground",
																		)}
																	>
																		<div className="inline-grid w-full grid-cols-[1fr_auto_auto] items-baseline justify-end gap-x-1">
																			<span className="text-right leading-none">
																				{formatAmountFromCents(
																					partner.salesBreakdown.concluded
																						.grossAmount,
																				)}
																			</span>
																			<span
																				aria-hidden="true"
																				className="leading-none opacity-70"
																			>
																				•
																			</span>
																			<span
																				className={cn(
																					"min-w-[4ch] text-left text-xs leading-none tabular-nums",
																					concludedHasValue
																						? "font-semibold"
																						: "font-medium",
																				)}
																			>
																				{formatCount(
																					partner.salesBreakdown.concluded
																						.salesCount,
																				)}
																			</span>
																		</div>
																	</TableCell>
																	<TableCell
																		className={cn(
																			"px-3 py-3 text-right font-mono tabular-nums",
																			pendingHasValue
																				? "font-semibold text-foreground"
																				: "font-normal text-muted-foreground",
																		)}
																	>
																		<div className="inline-grid w-full grid-cols-[1fr_auto_auto] items-baseline justify-end gap-x-1">
																			<span className="text-right leading-none">
																				{formatAmountFromCents(
																					partner.salesBreakdown.pending
																						.grossAmount,
																				)}
																			</span>
																			<span
																				aria-hidden="true"
																				className="leading-none opacity-70"
																			>
																				•
																			</span>
																			<span
																				className={cn(
																					"min-w-[4ch] text-left text-xs leading-none tabular-nums",
																					pendingHasValue
																						? "font-semibold"
																						: "font-medium",
																				)}
																			>
																				{formatCount(
																					partner.salesBreakdown.pending
																						.salesCount,
																				)}
																			</span>
																		</div>
																	</TableCell>
																	<TableCell
																		className={cn(
																			"px-3 py-3 text-right font-mono tabular-nums",
																			delinquentHasValue
																				? "font-semibold text-foreground"
																				: "font-normal text-muted-foreground",
																		)}
																	>
																		<div className="inline-grid w-full grid-cols-[1fr_auto_auto] items-baseline justify-end gap-x-1">
																			<span className="text-right leading-none">
																				{formatAmountFromCents(
																					partner.delinquentGrossAmount,
																				)}
																			</span>
																			<span
																				aria-hidden="true"
																				className="leading-none opacity-70"
																			>
																				•
																			</span>
																			<span
																				className={cn(
																					"min-w-[4ch] text-left text-xs leading-none tabular-nums",
																					delinquentHasValue
																						? "font-semibold"
																						: "font-medium",
																				)}
																			>
																				{formatCount(
																					partner.delinquentSalesCount,
																				)}
																			</span>
																		</div>
																	</TableCell>
																	<TableCell
																		className={cn(
																			"px-3 py-3 text-right font-mono tabular-nums",
																			canceledHasValue
																				? "font-semibold text-foreground"
																				: "font-normal text-muted-foreground",
																		)}
																	>
																		<div className="inline-grid w-full grid-cols-[1fr_auto_auto] items-baseline justify-end gap-x-1">
																			<span className="text-right leading-none">
																				{formatAmountFromCents(
																					canceledMetrics.grossAmount,
																				)}
																			</span>
																			<span
																				aria-hidden="true"
																				className="leading-none opacity-70"
																			>
																				•
																			</span>
																			<span
																				className={cn(
																					"min-w-[4ch] text-left text-xs leading-none tabular-nums",
																					canceledHasValue
																						? "font-semibold"
																						: "font-medium",
																				)}
																			>
																				{formatCount(
																					canceledMetrics.salesCount,
																				)}
																			</span>
																		</div>
																	</TableCell>
																	</TableRow>
																);
															})}
															{partners.length === 0 ? (
																<TableRow className="bg-transparent hover:bg-transparent">
																	<TableCell
																		colSpan={5}
																		className="px-3 py-4 text-center text-sm text-muted-foreground"
																	>
																		Nenhum parceiro com venda no período filtrado.
																	</TableCell>
																</TableRow>
															) : null}
														</TableBody>
													</Table>
												</div>
											</ScrollArea>
										</CollapsibleContent>
									</div>
								</Collapsible>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function PartnerSalesStatusCard({ items }: { items: StatusFunnelItem[] }) {
	const [activeSliceIndex, setActiveSliceIndex] = useState<number | null>(null);
	const visibleItems = useMemo(
		() => items.filter((item) => item.status !== "APPROVED"),
		[items],
	);
	const pieData = visibleItems
		.map((item) => ({
			...item,
			fill: PARTNER_SALES_STATUS_META[item.status as StatusFunnelKey].color,
		}))
		.filter((item) => item.salesCount > 0) satisfies StatusFunnelPieDataItem[];

	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Distribuição por status</CardTitle>
				<CardDescription>
					Volume de vendas do mês, incluindo canceladas na visão de status.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="mx-auto flex justify-center">
					<ChartContainer
						config={statusFunnelChartConfig}
						className="h-[220px] w-[220px]"
					>
						<PieChart>
							<ChartTooltip
								content={
									<ChartTooltipContent
										nameKey="status"
										labelKey="label"
										formatter={(value, _name, item) => {
											const payload = item.payload as StatusFunnelPieDataItem;
											return (
												<div className="ml-auto text-right">
													<div className="font-medium">
														{formatCount(Number(value))} venda(s)
													</div>
													<div className="text-muted-foreground">
														{formatAmountFromCents(payload.grossAmount)}
													</div>
												</div>
											);
										}}
									/>
								}
							/>
							<Pie
								data={pieData}
								dataKey="salesCount"
								nameKey="status"
								innerRadius={54}
								outerRadius={92}
								paddingAngle={2}
								activeIndex={activeSliceIndex ?? undefined}
								isAnimationActive={false}
								onMouseEnter={(_entry, index) => setActiveSliceIndex(index)}
								onMouseLeave={() => setActiveSliceIndex(null)}
							>
								{pieData.map((entry, index) => (
									<Cell
										key={`${entry.status}-${entry.fill}`}
										fill={entry.fill}
										{...getPieSliceEmphasisProps(index, activeSliceIndex)}
									/>
								))}
							</Pie>
						</PieChart>
					</ChartContainer>
				</div>

				<div className="space-y-2">
					{visibleItems.map((item) => (
						<div
							key={item.status}
							className={cn(
								"flex items-center justify-between rounded-xl border px-3 py-2 text-sm",
								PARTNER_SALES_STATUS_META[item.status as StatusFunnelKey]
									.className,
							)}
						>
							<span className="font-medium">
								{
									PARTNER_SALES_STATUS_META[item.status as StatusFunnelKey]
										.label
								}
							</span>
							<div className="text-right">
								<div className="font-medium tabular-nums">
									{formatCount(item.salesCount)}
								</div>
								<div className="text-xs opacity-90">
									{formatAmountFromCents(item.grossAmount)}
								</div>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function PartnerCommissionDirectionPanel({
	title,
	totalAmount,
	pendingAmount,
	paidAmount,
	canceledAmount,
	intent,
}: {
	title: string;
	totalAmount: number;
	pendingAmount: number;
	paidAmount: number;
	canceledAmount: number;
	intent: "income" | "outcome";
}) {
	const tone =
		intent === "income"
			? "border-emerald-500/30 bg-emerald-500/10"
			: "border-amber-500/30 bg-amber-500/10";

	const buckets = [
		{ key: "pending", amount: pendingAmount },
		{ key: "paid", amount: paidAmount },
		{ key: "canceled", amount: canceledAmount },
	] as const;

	return (
		<div className={cn("rounded-2xl border p-4", tone)}>
			<div className="mb-4 flex items-start justify-between gap-3">
				<div>
					<div className="text-sm font-medium text-foreground">{title}</div>
					<div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
						{formatAmountFromCents(totalAmount)}
					</div>
				</div>
			</div>

			<div className="space-y-3">
				{buckets.map(({ key, amount }) => {
					const width =
						totalAmount === 0 ? 0 : Math.round((amount / totalAmount) * 100);

					return (
						<div key={key} className="space-y-1.5">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">
									{PARTNER_COMMISSION_STATUS_META[key].label}
								</span>
								<span className="font-medium tabular-nums">
									{formatAmountFromCents(amount)}
								</span>
							</div>
							<div className="h-2 rounded-full bg-background/80">
								<div
									className={cn(
										"h-2 rounded-full bg-gradient-to-r",
										PARTNER_COMMISSION_STATUS_META[key].color,
									)}
									style={{ width: `${width}%` }}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function PartnerCommissionsByCompetencyCard({
	commissionBreakdown,
}: {
	commissionBreakdown: PartnerCommissionBreakdown | undefined;
}) {
	const incomePaidAmount = commissionBreakdown?.receivedAmount ?? 0;
	const incomePendingAmount = commissionBreakdown?.pendingAmount ?? 0;
	const incomeCanceledAmount = commissionBreakdown?.canceledAmount ?? 0;
	const incomeTotalAmount =
		incomePaidAmount + incomePendingAmount + incomeCanceledAmount;
	const outcomePaidAmount =
		commissionBreakdown?.payablePaidAmount ??
		Math.max(
			incomePaidAmount - (commissionBreakdown?.netRevenueAmount ?? 0),
			0,
		);
	const outcomePendingAmount = commissionBreakdown?.payablePendingAmount ?? 0;
	const outcomeCanceledAmount = commissionBreakdown?.payableCanceledAmount ?? 0;
	const outcomeTotalAmount =
		outcomePaidAmount + outcomePendingAmount + outcomeCanceledAmount;

	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Comissões das vendas do período</CardTitle>
				<CardDescription>
					Parcelas geradas pelas vendas do período, separadas entre receber e pagar.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<PartnerCommissionDirectionPanel
					title="A receber"
					totalAmount={incomeTotalAmount}
					pendingAmount={incomePendingAmount}
					paidAmount={incomePaidAmount}
					canceledAmount={incomeCanceledAmount}
					intent="income"
				/>
				<PartnerCommissionDirectionPanel
					title="A pagar"
					totalAmount={outcomeTotalAmount}
					pendingAmount={outcomePendingAmount}
					paidAmount={outcomePaidAmount}
					canceledAmount={outcomeCanceledAmount}
					intent="outcome"
				/>
			</CardContent>
		</Card>
	);
}

function DelinquencyBreakdownCard({
	totalSales,
	preCancellation,
	buckets,
}: {
	totalSales: number;
	preCancellation: NonNullable<
		PartnerDashboardDelinquencyBreakdown["preCancellation"]
	>;
	buckets: PartnerDashboardData["delinquencyBreakdown"]["buckets"];
}) {
	const [activeSliceIndex, setActiveSliceIndex] = useState<number | null>(null);
	const pieData = useMemo(() => buildDelinquencyPieData(buckets), [buckets]);
	const pieDataWithSales = useMemo(
		() => pieData.filter((item) => item.salesCount > 0),
		[pieData],
	);
	const totalDelinquentAmount = useMemo(
		() => buckets.reduce((sum, bucket) => sum + bucket.grossAmount, 0),
		[buckets],
	);

	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Inadimplência</CardTitle>
				<CardDescription>
					Agrupamento por quantidade de inadimplências abertas nas vendas dos
					parceiros.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
					<div className="rounded-xl border bg-muted/20 p-3">
						<div className="text-xs text-muted-foreground">
							Vendas inadimplentes
						</div>
						<div className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
							{formatCount(totalSales)}
						</div>
					</div>
					<div className="rounded-xl border bg-muted/20 p-3 text-right">
						<div className="text-xs text-muted-foreground">
							Produção em risco
						</div>
						<div className="mt-1 text-sm font-semibold text-foreground">
							{formatAmountFromCents(totalDelinquentAmount)}
						</div>
					</div>
					<div className="rounded-xl border bg-muted/20 p-3 sm:text-right">
						<div className="text-xs text-muted-foreground">
							Pré-cancelamento
						</div>
						<div className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
							{formatCount(preCancellation.salesCount)}
						</div>
						<div className="text-[11px] text-muted-foreground">
							{preCancellation.threshold === null
								? "Regra desativada"
								: `A partir de ${preCancellation.threshold} inadimpl${preCancellation.threshold === 1 ? "ência" : "ências"}`}
						</div>
					</div>
				</div>
				{pieDataWithSales.length === 0 ? (
					<div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
						Sem inadimplência no período selecionado.
					</div>
				) : (
					<div className="space-y-4">
						<div className="mx-auto w-full max-w-[460px]">
							<ChartContainer
								config={delinquencyChartConfig}
								className="h-[340px] w-full"
							>
								<PieChart margin={{ top: 24, right: 56, bottom: 24, left: 56 }}>
									<ChartTooltip
										content={
											<ChartTooltipContent
												hideLabel
												formatter={(value, _name, item) => {
													const dataPoint =
														item.payload as DelinquencyPieDataItem;
													return (
														<div className="flex w-full flex-col gap-1">
															<div className="font-medium text-foreground">
																{dataPoint.label}
															</div>
															<div className="flex items-center justify-between gap-3">
																<span className="text-muted-foreground">
																	Inadimplências
																</span>
																<span className="font-mono font-medium tabular-nums text-foreground">
																	{formatCount(Number(value))}
																</span>
															</div>
															<div className="flex items-center justify-between gap-3">
																<span className="text-muted-foreground">
																	Participação
																</span>
																<span className="font-mono font-medium tabular-nums text-foreground">
																	{formatSharePercentage(dataPoint.sharePct)}
																</span>
															</div>
															<div className="flex items-center justify-between gap-3">
																<span className="text-muted-foreground">
																	Produção
																</span>
																<span className="font-mono font-medium tabular-nums text-foreground">
																	{formatAmountFromCents(dataPoint.grossAmount)}
																</span>
															</div>
														</div>
													);
												}}
											/>
										}
									/>
									<Pie
										data={pieDataWithSales}
										dataKey="delinquencyCount"
										nameKey="label"
										cx="50%"
										cy="48%"
										innerRadius={44}
										outerRadius={78}
										paddingAngle={3}
										labelLine={false}
										label={renderDelinquencyPieLabel}
										activeIndex={activeSliceIndex ?? undefined}
										isAnimationActive={false}
										onMouseEnter={(_entry, index) => setActiveSliceIndex(index)}
										onMouseLeave={() => setActiveSliceIndex(null)}
									>
										{pieDataWithSales.map((entry, index) => (
											<Cell
												key={`${entry.key}-${entry.fill}`}
												fill={entry.fill}
												{...getPieSliceEmphasisProps(
													index,
													activeSliceIndex,
												)}
											/>
										))}
									</Pie>
								</PieChart>
							</ChartContainer>
						</div>

						<div className="space-y-2">
							{pieData.map((item) => (
								<div
									key={item.key}
									className="flex items-center justify-between rounded-xl border border-border/70 bg-background/80 px-3 py-2"
								>
									<div className="flex min-w-0 items-center gap-2">
										<span
											className="size-2.5 shrink-0 rounded-full"
											style={{ backgroundColor: item.fill }}
										/>
										<span className="truncate text-xs text-foreground">
											{item.label}
										</span>
									</div>
									<div className="text-right">
										<div className="text-xs font-medium tabular-nums text-foreground">
											{formatCount(item.delinquencyCount)}
										</div>
										<div className="text-[11px] text-muted-foreground">
											{formatSharePercentage(item.sharePct)}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function DashboardPartnersSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
				{Array.from({ length: 8 }).map((_, index) => (
					<Card key={index} className="border-border/70">
						<CardContent className="space-y-3 p-5">
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-8 w-32" />
							<Skeleton className="h-4 w-40" />
						</CardContent>
					</Card>
				))}
			</div>
			<div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.8fr)_360px]">
				<Skeleton className="h-[360px] rounded-xl" />
				<div className="grid grid-cols-1 gap-4">
					<Skeleton className="h-[220px] rounded-xl" />
					<Skeleton className="h-[220px] rounded-xl" />
				</div>
			</div>
			<div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_1fr]">
				<Skeleton className="h-[420px] rounded-xl" />
				<Skeleton className="h-[360px] rounded-xl" />
			</div>
			<Skeleton className="h-[360px] rounded-xl" />
		</div>
	);
}

export function DashboardPartnersOverview() {
	const [dashboardView, setDashboardView] = useQueryState(
		"dashboard",
		dashboardViewParser,
	);
	const [startDate, setStartDate] = useQueryState(
		"startDate",
		dateFilterParser,
	);
	const [endDate, setEndDate] = useQueryState("endDate", dateFilterParser);
	const [inactiveMonths, setInactiveMonths] = useQueryState(
		"inactiveMonths",
		dashboardInactiveMonthsParser,
	);
	const [supervisorId, setSupervisorId] = useQueryState(
		"supervisorId",
		entityFilterParser,
	);
	const [partnerIdsCsv, setPartnerIdsCsv] = useQueryState(
		"partnerIds",
		entityFilterParser,
	);
	const [dynamicFieldId, setDynamicFieldId] = useQueryState(
		"dynamicFieldId",
		entityFilterParser,
	);
	const [productBreakdownDepth, setProductBreakdownDepth] = useQueryState(
		"productBreakdownDepth",
		productBreakdownDepthParser,
	);
	const [isFiltersVisible, setIsFiltersVisible] = useState(false);
	const [selectedTimelineSeries, setSelectedTimelineSeries] =
		useState<TimelineSeriesKey>("concludedAndProcessedAmount");

	const defaultStartDate = useMemo(() => getDefaultStartDate(), []);
	const defaultEndDate = useMemo(() => getDefaultEndDate(), []);
	const effectiveStartDate = isValidDateFilterInput(startDate)
		? startDate
		: defaultStartDate;
	const effectiveEndDate = isValidDateFilterInput(endDate)
		? endDate
		: defaultEndDate;
	const effectiveSupervisorId = isValidUuid(supervisorId) ? supervisorId : "";
	const effectiveDynamicFieldId = isValidUuid(dynamicFieldId)
		? dynamicFieldId
		: "";
	const selectedPartnerIds = useMemo(
		() => parsePartnerIdsCsv(partnerIdsCsv).filter(isValidUuid),
		[partnerIdsCsv],
	);
	const effectivePartnerIdsCsv =
		selectedPartnerIds.length > 0
			? serializePartnerIdsCsv(selectedPartnerIds)
			: undefined;
	const previousMonthCanceledDateRange = useMemo(
		() => getPreviousMonthDateRange(effectiveEndDate),
		[effectiveEndDate],
	);

	useEffect(() => {
		if (!isValidDateFilterInput(startDate)) {
			void setStartDate(defaultStartDate);
		}
	}, [defaultStartDate, setStartDate, startDate]);

	useEffect(() => {
		if (!isValidDateFilterInput(endDate)) {
			void setEndDate(defaultEndDate);
		}
	}, [defaultEndDate, endDate, setEndDate]);

	useEffect(() => {
		if (dashboardView !== "partners") {
			void setDashboardView("partners");
		}
	}, [dashboardView, setDashboardView]);

	useEffect(() => {
		if (effectiveStartDate <= effectiveEndDate) {
			return;
		}

		void setEndDate(effectiveStartDate);
	}, [effectiveEndDate, effectiveStartDate, setEndDate]);

	const query = usePartnerSalesDashboard({
		startDate: effectiveStartDate,
		endDate: effectiveEndDate,
		inactiveMonths,
		supervisorId: effectiveSupervisorId || undefined,
		partnerIds: effectivePartnerIdsCsv,
	});
	const dynamicFieldBreakdownQuery = usePartnerSalesDashboard({
		startDate: effectiveStartDate,
		endDate: effectiveEndDate,
		inactiveMonths,
		supervisorId: effectiveSupervisorId || undefined,
		partnerIds: effectivePartnerIdsCsv,
		dynamicFieldId: effectiveDynamicFieldId || undefined,
		keepPreviousData: false,
	});
	const productBreakdownQuery = usePartnerSalesDashboard({
		startDate: effectiveStartDate,
		endDate: effectiveEndDate,
		inactiveMonths,
		supervisorId: effectiveSupervisorId || undefined,
		partnerIds: effectivePartnerIdsCsv,
		productBreakdownDepth,
	});
	const previousMonthCanceledQuery = usePartnerSalesDashboard({
		startDate: previousMonthCanceledDateRange.startDate,
		endDate: previousMonthCanceledDateRange.endDate,
		inactiveMonths,
		supervisorId: effectiveSupervisorId || undefined,
		partnerIds: effectivePartnerIdsCsv,
	});
	const data = query.data;
	const dynamicFieldBreakdown =
		effectiveDynamicFieldId && dynamicFieldBreakdownQuery.data
			? dynamicFieldBreakdownQuery.data.dynamicFieldBreakdown
			: data?.dynamicFieldBreakdown;
	const productBreakdown =
		productBreakdownQuery.data?.productBreakdown ?? data?.productBreakdown;
	const previousMonthCanceledByPartnerId = useMemo(() => {
		const map: Record<
			string,
			{
				grossAmount: number;
				salesCount: number;
			}
		> = {};

		for (const partner of previousMonthCanceledQuery.data?.ranking ?? []) {
			map[partner.partnerId] = {
				grossAmount: partner.salesBreakdown.canceled.grossAmount,
				salesCount: partner.salesBreakdown.canceled.salesCount,
			};
		}

		return map;
	}, [previousMonthCanceledQuery.data?.ranking]);
	const hasPreviousMonthCanceledData = Boolean(previousMonthCanceledQuery.data);
	const partnerOptions = useMemo(() => {
		const allPartners = data?.filters.partners ?? [];
		if (!effectiveSupervisorId) {
			return allPartners;
		}

		return allPartners.filter((partner) =>
			partner.supervisors.some(
				(supervisor) => supervisor.id === effectiveSupervisorId,
			),
		);
	}, [data?.filters.partners, effectiveSupervisorId]);
	const availableDynamicFieldOptions = useMemo(() => {
		return dedupeAvailableDynamicFields(
			data?.dynamicFieldBreakdown.availableFields ?? [],
			dynamicFieldBreakdown?.selectedFieldId ?? null,
		);
	}, [
		data?.dynamicFieldBreakdown.availableFields,
		dynamicFieldBreakdown?.selectedFieldId,
	]);

	useEffect(() => {
		if (!data) {
			return;
		}

		const allowedIds = new Set(partnerOptions.map((partner) => partner.id));
		const sanitizedIds = selectedPartnerIds.filter((id) => allowedIds.has(id));
		if (sanitizedIds.length === selectedPartnerIds.length) {
			return;
		}

		void setPartnerIdsCsv(serializePartnerIdsCsv(sanitizedIds));
	}, [data, partnerOptions, selectedPartnerIds, setPartnerIdsCsv]);

	useEffect(() => {
		if (!data) {
			return;
		}

		if (effectiveDynamicFieldId) {
			return;
		}

		const nextDynamicFieldId = data.dynamicFieldBreakdown.selectedFieldId ?? "";
		if (dynamicFieldId === nextDynamicFieldId) {
			return;
		}

		void setDynamicFieldId(nextDynamicFieldId);
	}, [data, dynamicFieldId, effectiveDynamicFieldId, setDynamicFieldId]);

	useEffect(() => {
		if (!effectiveDynamicFieldId || !dynamicFieldBreakdownQuery.data) {
			return;
		}

		const nextDynamicFieldId =
			dynamicFieldBreakdownQuery.data.dynamicFieldBreakdown.selectedFieldId ??
			"";
		if (dynamicFieldId === nextDynamicFieldId) {
			return;
		}

		void setDynamicFieldId(nextDynamicFieldId);
	}, [
		dynamicFieldBreakdownQuery.data,
		dynamicFieldId,
		effectiveDynamicFieldId,
		setDynamicFieldId,
	]);

	const summary = data?.summary;
	const hasPartners = (summary?.totalPartners ?? 0) > 0;
	const hasSales = (summary?.totalSales ?? 0) > 0;
	const recencyBuckets = data?.recencyBreakdown.buckets ?? [];
	const partnersWithoutProductionInThreeMonths = recencyBuckets
		.filter(
			(bucket) => bucket.key === "RANGE_90_PLUS" || bucket.key === "NO_SALES",
		)
		.reduce((total, bucket) => total + bucket.partnersCount, 0);
	const timelineChartData = useMemo(
		() =>
			(data?.timeline ?? []).map((item) => ({
				date: item.date,
				label: item.label,
				concludedAndProcessedAmount:
					item.concludedAndProcessedGrossAmount / 100,
				concludedAmount: item.concludedGrossAmount / 100,
				processedAmount: item.processedGrossAmount / 100,
				canceledAmount: item.canceledGrossAmount / 100,
				salesCount: item.salesCount,
			})),
		[data?.timeline],
	);
	const timelineDailyPeakAmount = useMemo(
		() =>
			Math.max(...(data?.timeline ?? []).map((item) => item.grossAmount), 0),
		[data?.timeline],
	);
	const timelineDaysWithSales = useMemo(
		() => (data?.timeline ?? []).filter((item) => item.salesCount > 0).length,
		[data?.timeline],
	);
	const timelineGranularity = data?.period.timelineGranularity ?? "DAY";
	const timelineSeriesKeysToRender =
		selectedTimelineSeries === "concludedAndProcessedAmount"
			? TIMELINE_SERIES_OPTIONS.map((item) => item.key)
			: [selectedTimelineSeries];
	const timelineAreaGradientIdPrefix = useId().replace(/:/g, "");
	const timelineAreaGradientIds = useMemo(
		() => ({
			concludedAndProcessedAmount: `${timelineAreaGradientIdPrefix}-timeline-concluded-and-processed`,
			concludedAmount: `${timelineAreaGradientIdPrefix}-timeline-concluded`,
			processedAmount: `${timelineAreaGradientIdPrefix}-timeline-processed`,
			canceledAmount: `${timelineAreaGradientIdPrefix}-timeline-canceled`,
		}),
		[timelineAreaGradientIdPrefix],
	);

	if (query.isError) {
		return (
			<Card className="border-rose-500/30 bg-rose-500/10">
				<CardContent className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<div className="font-medium text-rose-700 dark:text-rose-300">
							Não foi possível carregar o dashboard de parceiros.
						</div>
						<div className="text-sm text-rose-700 dark:text-rose-300">
							Revise a conexão com a API e tente novamente.
						</div>
					</div>
					<Button onClick={() => void query.refetch()} variant="outline">
						<RefreshCcw className="size-4" />
						Tentar novamente
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<section className="space-y-6">
			<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="space-y-2">
					<div>
						<h1 className="text-3xl font-semibold tracking-tight text-foreground">
							Dashboard de parceiros
						</h1>
						<p className="max-w-3xl text-sm text-muted-foreground">
							Acompanhe produção, ranking, comissões recebidas, receita e
							inadimplência das vendas com responsável parceiro.
						</p>
					</div>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<Button
						type="button"
						variant="outline"
						className="rounded-full"
						onClick={() => setIsFiltersVisible((prevState) => !prevState)}
					>
						<Funnel className="size-4" />
						{isFiltersVisible ? "Ocultar filtros" : "Filtros"}
					</Button>
					<Button asChild variant="outline" className="rounded-full">
						<Link to="/registers/partners">
							<Users className="size-4" />
							Parceiros
						</Link>
					</Button>
					<Button asChild variant="outline" className="rounded-full">
						<Link to="/sales/delinquency">
							<ShieldAlert className="size-4" />
							Inadimplência
						</Link>
					</Button>
					<Button asChild className="rounded-full">
						<Link to="/sales">
							<BriefcaseBusiness className="size-4" />
							Vendas
						</Link>
					</Button>
				</div>
			</header>

			{isFiltersVisible ? (
				<FilterPanel className="xl:grid-cols-6">
					<div className="space-y-2">
						<Label>Data inicial</Label>
						<CalendarDateInput
							value={effectiveStartDate}
							maxDate={new Date()}
							locale={ptBR}
							onChange={(value) => {
								const nextValue = value || defaultStartDate;
								void setStartDate(nextValue);
								if (nextValue > effectiveEndDate) {
									void setEndDate(nextValue);
								}
							}}
						/>
					</div>
					<div className="space-y-2">
						<Label>Data final</Label>
						<CalendarDateInput
							value={effectiveEndDate}
							locale={ptBR}
							onChange={(value) => {
								const nextValue = value || defaultEndDate;
								void setEndDate(nextValue);
								if (nextValue < effectiveStartDate) {
									void setStartDate(nextValue);
								}
							}}
						/>
					</div>
					<div className="space-y-2">
						<Label>Janela sem produção</Label>
						<Select
							value={String(inactiveMonths)}
							onValueChange={(value) => void setInactiveMonths(Number(value))}
						>
							<SelectTrigger className="w-full rounded-full">
								<SelectValue placeholder="Selecione" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="1">1 mês</SelectItem>
								<SelectItem value="3">3 meses</SelectItem>
								<SelectItem value="6">6 meses</SelectItem>
								<SelectItem value="12">12 meses</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>Supervisor</Label>
						<Select
							value={effectiveSupervisorId || "ALL"}
							onValueChange={(value) => {
								void setSupervisorId(value === "ALL" ? "" : value);
							}}
						>
							<SelectTrigger className="w-full rounded-full">
								<SelectValue placeholder="Todos os supervisores" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ALL">Todos os supervisores</SelectItem>
								{(data?.filters.supervisors ?? []).map((supervisor) => (
									<SelectItem key={supervisor.id} value={supervisor.id}>
										{supervisor.name ?? "Supervisor sem nome"}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>Parceiros</Label>
						<PartnerMultiSelectFilter
							options={partnerOptions}
							selectedIds={selectedPartnerIds}
							onChange={(ids) =>
								void setPartnerIdsCsv(serializePartnerIdsCsv(ids))
							}
							disabled={!data}
						/>
					</div>
				</FilterPanel>
			) : null}
			<LoadingReveal
				loading={query.isLoading && !data}
				skeleton={<DashboardPartnersSkeleton />}
				contentKey={`${effectiveStartDate}-${effectiveEndDate}-${effectiveSupervisorId}-${effectivePartnerIdsCsv}-${inactiveMonths}`}
				className="space-y-6"
				stagger
			>
				{!hasPartners ? (
					<Card className="border-dashed border-border bg-muted/20">
						<CardContent className="flex flex-col gap-4 py-8 lg:flex-row lg:items-center lg:justify-between">
							<div className="space-y-1">
								<div className="font-medium text-foreground">
									Nenhum parceiro encontrado para os filtros selecionados.
								</div>
								<p className="text-sm text-muted-foreground">
									Ajuste supervisor, parceiros ou o período para visualizar os
									indicadores.
								</p>
							</div>
							<Button asChild variant="outline">
								<Link to="/registers/partners">Gerenciar parceiros</Link>
							</Button>
						</CardContent>
					</Card>
				) : null}

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
					<PartnerKpiCard
						title="Total de parceiros"
						value={formatCount(summary?.totalPartners ?? 0)}
						subtitle={`${formatCount(summary?.producingPartners ?? 0)} produzindo • ${formatCount(summary?.inactivePartners ?? 0)} inativos`}
						icon={Users}
						toneClassName="bg-slate-500/10 text-slate-700 dark:text-slate-300"
					/>
					<PartnerKpiCard
						title="Sem produção (3 meses)"
						value={formatCount(partnersWithoutProductionInThreeMonths)}
						subtitle="Parceiros sem venda nos últimos 90 dias"
						icon={Clock3}
						toneClassName="bg-amber-500/10 text-amber-700 dark:text-amber-300"
					/>
					<PartnerKpiCard
						title="Produção"
						value={formatAmountFromCents(summary?.grossAmount ?? 0)}
						subtitle="Volume total no período"
						icon={CircleDollarSign}
						toneClassName="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
					/>
					<PartnerKpiCard
						title="Total de vendas"
						value={formatCount(summary?.totalSales ?? 0)}
						subtitle="Vendas com responsável parceiro"
						icon={ShoppingCart}
						toneClassName="bg-sky-500/10 text-sky-700 dark:text-sky-300"
					/>
					<PartnerKpiCard
						title="Ticket médio"
						value={formatAmountFromCents(summary?.averageTicket ?? 0)}
						subtitle="Produção média por venda"
						icon={BadgeDollarSign}
						toneClassName="bg-violet-500/10 text-violet-700 dark:text-violet-300"
					/>
					<PartnerKpiCard
						title="Vendas inadimplentes"
						value={formatCount(summary?.delinquentSalesCount ?? 0)}
						subtitle="Quantidade com inadimplência aberta"
						icon={ShieldAlert}
						toneClassName="bg-orange-500/10 text-orange-700 dark:text-orange-300"
					/>
				</div>

				{hasPartners && !hasSales ? (
					<Card className="border-dashed border-border bg-muted/20">
						<CardContent className="flex flex-col gap-4 py-8 lg:flex-row lg:items-center lg:justify-between">
							<div className="space-y-1">
								<div className="font-medium text-foreground">
									Nenhuma venda de parceiro encontrada neste período.
								</div>
								<p className="text-sm text-muted-foreground">
									Os parceiros seguem visíveis, mas sem produção no intervalo
									atual.
								</p>
							</div>
							<Button asChild variant="outline">
								<Link to="/sales">Ver vendas</Link>
							</Button>
						</CardContent>
					</Card>
				) : null}

				<div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr_1fr]">
					<Card className="overflow-hidden border-border/70">
						<CardHeader className="border-b">
							<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
								<div className="space-y-1">
									<CardTitle>
										{timelineGranularity === "DAY"
											? "Vendas por dia"
											: "Faturamento por mês"}
									</CardTitle>
									<CardDescription>
										Visualize concluídas e processadas no período, com opção de
										comparar as canceladas.
									</CardDescription>
								</div>
								<TimelineSeriesSelectFilter
									selectedKey={selectedTimelineSeries}
									onChange={setSelectedTimelineSeries}
								/>
							</div>
						</CardHeader>
						<CardContent className="space-y-4 pt-6">
							<ChartContainer
								config={timelineChartConfig}
								className="h-[290px] w-full"
							>
								<AreaChart data={timelineChartData}>
									<defs>
										{TIMELINE_SERIES_OPTIONS.map((option) => (
											<linearGradient
												key={option.key}
												id={timelineAreaGradientIds[option.key]}
												x1="0"
												y1="0"
												x2="0"
												y2="1"
											>
												<stop
													offset="5%"
													stopColor={`var(--color-${option.key})`}
													stopOpacity={0.7}
												/>
												<stop
													offset="95%"
													stopColor={`var(--color-${option.key})`}
													stopOpacity={0.1}
												/>
											</linearGradient>
										))}
									</defs>
									<CartesianGrid vertical={false} />
									<XAxis
										dataKey="label"
										tickLine={false}
										axisLine={false}
										tickMargin={8}
										minTickGap={24}
									/>
									<YAxis
										tickLine={false}
										axisLine={false}
										tickFormatter={(value) => formatCurrencyBRL(Number(value))}
									/>
									<ChartTooltip
										cursor={false}
										content={
											<ChartTooltipContent
												labelFormatter={(_, payload) => {
													const item = payload?.[0]?.payload as
														| { label?: string }
														| undefined;
													return item?.label ?? "";
												}}
												formatter={(value, name) => {
													const seriesKey = String(name) as TimelineSeriesKey;
													const seriesLabel =
														timelineChartConfig[seriesKey]?.label ?? name;
													return (
														<div className="flex w-full items-center justify-between gap-2">
															<span className="text-muted-foreground">
																{seriesLabel}
															</span>
															<div className="font-medium">
																{formatCurrencyBRL(Number(value))}
															</div>
														</div>
													);
												}}
												indicator="dot"
											/>
										}
									/>
									{timelineSeriesKeysToRender.map((seriesKey) => (
										<Area
											key={seriesKey}
											dataKey={seriesKey}
											type="natural"
											stroke={`var(--color-${seriesKey})`}
											strokeWidth={2}
											fill={`url(#${timelineAreaGradientIds[seriesKey]})`}
											activeDot={{ r: 5 }}
										/>
									))}
								</AreaChart>
							</ChartContainer>

							<div className="grid grid-cols-2 gap-3 text-sm">
								<PartnerCompactMetric
									label={
										timelineGranularity === "DAY"
											? "Pico diário"
											: "Pico mensal"
									}
									value={formatAmountFromCents(timelineDailyPeakAmount)}
								/>
								<PartnerCompactMetric
									label={
										timelineGranularity === "DAY"
											? "Dias com venda"
											: "Meses com venda"
									}
									value={String(timelineDaysWithSales)}
								/>
							</div>
						</CardContent>
					</Card>

					<PartnerSalesStatusCard items={data?.statusFunnel.items ?? []} />
					<PartnerCommissionsByCompetencyCard
						commissionBreakdown={data?.commissionBreakdown}
					/>
				</div>

				<div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(450px,500px)]">
					<PartnerRankingSection items={data?.ranking ?? []} />
					<PartnerSalesSharePieCard items={data?.ranking ?? []} />
				</div>
				<SupervisorRankingSection
					items={data?.ranking ?? []}
					canceledByPartnerId={previousMonthCanceledByPartnerId}
					hasPreviousMonthCanceledData={hasPreviousMonthCanceledData}
				/>

				<div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.05fr)_minmax(0,1.2fr)]">
					<LoadingReveal
						loading={
							Boolean(effectiveDynamicFieldId) &&
							dynamicFieldBreakdownQuery.isLoading &&
							!dynamicFieldBreakdownQuery.data
						}
						skeleton={
							<Card className="h-full border-border/70">
								<CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
									<div className="min-w-0 flex-1 space-y-2">
										<Skeleton className="h-5 w-48" />
										<Skeleton className="h-4 w-64 max-w-full" />
									</div>
									<Skeleton className="h-10 w-[220px] rounded-full" />
								</CardHeader>
								<CardContent className="space-y-4 pt-0">
									<Skeleton className="mx-auto h-[230px] w-full max-w-[260px] rounded-xl" />
									<div className="grid grid-cols-2 gap-2">
										<Skeleton className="h-14 w-full rounded-xl" />
										<Skeleton className="h-14 w-full rounded-xl" />
									</div>
									<div className="space-y-2">
										<Skeleton className="h-12 w-full rounded-xl" />
										<Skeleton className="h-12 w-full rounded-xl" />
										<Skeleton className="h-12 w-full rounded-xl" />
									</div>
								</CardContent>
							</Card>
						}
						contentKey={
							dynamicFieldBreakdown?.selectedFieldId ??
							"dynamic-field-breakdown"
						}
					>
						<PartnerBreakdownPieCard
							title={`Vendas por ${dynamicFieldBreakdown?.selectedFieldLabel ?? "campo personalizado"}`}
							description="Distribuição das vendas por valor do campo selecionado."
							items={dynamicFieldBreakdown?.items ?? []}
							emptyMessage="Nenhum valor preenchido para o campo selecionado neste período."
							headerAction={
								<Select
									value={dynamicFieldBreakdown?.selectedFieldId ?? "NONE"}
									disabled={!data || availableDynamicFieldOptions.length === 0}
									onValueChange={(value) =>
										void setDynamicFieldId(value === "NONE" ? "" : value)
									}
								>
									<SelectTrigger className="w-[220px] rounded-full">
										<SelectValue placeholder="Sem campos elegíveis" />
									</SelectTrigger>
									<SelectContent>
										{availableDynamicFieldOptions.length === 0 ? (
											<SelectItem value="NONE">Sem campos elegíveis</SelectItem>
										) : (
											availableDynamicFieldOptions.map((field) => (
												<SelectItem key={field.fieldId} value={field.fieldId}>
													{field.label}
												</SelectItem>
											))
										)}
									</SelectContent>
								</Select>
							}
						/>
					</LoadingReveal>

					<LoadingReveal
						loading={
							Boolean(data) &&
							productBreakdownQuery.isLoading &&
							!productBreakdownQuery.data
						}
						skeleton={
							<Card className="h-full border-border/70">
								<CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
									<div className="min-w-0 flex-1 space-y-2">
										<Skeleton className="h-5 w-56" />
										<Skeleton className="h-4 w-72 max-w-full" />
									</div>
									<Skeleton className="h-10 w-[160px] rounded-full" />
								</CardHeader>
								<CardContent className="space-y-4 pt-0">
									<Skeleton className="mx-auto h-[230px] w-full max-w-[260px] rounded-xl" />
									<div className="grid grid-cols-2 gap-2">
										<Skeleton className="h-14 w-full rounded-xl" />
										<Skeleton className="h-14 w-full rounded-xl" />
									</div>
									<div className="space-y-2">
										<Skeleton className="h-12 w-full rounded-xl" />
										<Skeleton className="h-12 w-full rounded-xl" />
										<Skeleton className="h-12 w-full rounded-xl" />
									</div>
								</CardContent>
							</Card>
						}
						contentKey={`product-breakdown-${productBreakdownDepth}`}
					>
						<PartnerBreakdownPieCard
							title="Vendas por Produto"
							description={
								productBreakdownDepth === "ALL_LEVELS"
									? "Distribuição pelo caminho completo dos produtos vendidos."
									: "Distribuição pelo primeiro nível abaixo do produto pai."
							}
							items={productBreakdown?.items ?? []}
							emptyMessage="Nenhum produto encontrado nas vendas do período selecionado."
							variant="regular"
							headerAction={
								<Select
									value={productBreakdownDepth}
									onValueChange={(value) =>
										void setProductBreakdownDepth(
											value as "FIRST_LEVEL" | "ALL_LEVELS",
										)
									}
								>
									<SelectTrigger className="w-[160px] rounded-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="FIRST_LEVEL">1º nível</SelectItem>
										<SelectItem value="ALL_LEVELS">Todos os níveis</SelectItem>
									</SelectContent>
								</Select>
							}
						/>
					</LoadingReveal>

					<DelinquencyBreakdownCard
						totalSales={(
							(data?.delinquencyBreakdown ??
								{}) as PartnerDashboardDelinquencyBreakdown
						).totalSales ?? 0}
						preCancellation={
							(
								(data?.delinquencyBreakdown ??
									{}) as PartnerDashboardDelinquencyBreakdown
							).preCancellation ?? {
								threshold: null,
								salesCount: 0,
								grossAmount: 0,
							}
						}
						buckets={data?.delinquencyBreakdown.buckets ?? []}
					/>
				</div>
			</LoadingReveal>
		</section>
	);
}
