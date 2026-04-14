import { endOfMonth, format, parse, startOfMonth, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "@tanstack/react-router";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from "recharts";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryState } from "nuqs";
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
import { Badge } from "@/components/ui/badge";
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
	amount: {
		label: "Faturamento",
		color: "hsl(160 84% 39%)",
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
type DashboardBreakdownItem =
	PartnerDashboardData["dynamicFieldBreakdown"]["items"][number];
type StatusFunnelItem = PartnerDashboardData["statusFunnel"]["items"][number];
type StatusFunnelKey = StatusFunnelItem["status"];
type BreakdownPieDataItem = DashboardBreakdownItem & {
	fill: string;
};
type StatusFunnelPieDataItem = StatusFunnelItem & {
	fill: string;
};
type DelinquencyPieDataItem =
	PartnerDashboardData["delinquencyBreakdown"]["buckets"][number] & {
		fill: string;
	};

type PartnerKpiCardProps = {
	title: string;
	value: string;
	subtitle: string;
	icon: typeof Users;
	toneClassName: string;
};

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

function isValidDateFilterInput(value: string | null | undefined): value is string {
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

function buildBreakdownPieData(items: DashboardBreakdownItem[]) {
	return items.map((item, index) => ({
		...item,
		fill: BREAKDOWN_PIE_COLORS[index % BREAKDOWN_PIE_COLORS.length]!,
	})) satisfies BreakdownPieDataItem[];
}

function buildDelinquencyPieData(
	buckets: PartnerDashboardData["delinquencyBreakdown"]["buckets"],
) {
	return buckets.map((bucket, index) => ({
		...bucket,
		fill: DELINQUENCY_PIE_COLORS[index % DELINQUENCY_PIE_COLORS.length]!,
	})) satisfies DelinquencyPieDataItem[];
}

function PartnerKpiCard({
	title,
	value,
	subtitle,
	icon: Icon,
	toneClassName,
}: PartnerKpiCardProps) {
	return (
		<Card className="border-border/70">
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
				? (selectedPartners[0]?.name ?? "1 parceiro")
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
						{options.map((option) => (
							<DropdownMenuCheckboxItem
								key={option.id}
								checked={selectedIdSet.has(option.id)}
								onCheckedChange={(checked) =>
									togglePartner(option.id, Boolean(checked))
								}
							>
								<div className="flex flex-col gap-0.5">
									<span className="font-medium">{option.name}</span>
									<span className="text-xs text-muted-foreground">
										{option.supervisorName ?? "Sem supervisor"}
									</span>
								</div>
							</DropdownMenuCheckboxItem>
						))}
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
		<Card className="h-full border-border/70">
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
								isCompact ? "max-w-[260px]" : "max-w-[292px]",
							)}
						>
							<ChartContainer
								config={breakdownPieChartConfig}
								className={cn("w-full", isCompact ? "h-[230px]" : "h-[250px]")}
							>
								<PieChart>
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
										dataKey="salesCount"
										nameKey="label"
										innerRadius={isCompact ? 54 : 60}
										outerRadius={isCompact ? 88 : 96}
										paddingAngle={2}
									>
										{pieData.map((entry) => (
											<Cell
												key={`${entry.valueId}-${entry.fill}`}
												fill={entry.fill}
											/>
										))}
									</Pie>
								</PieChart>
							</ChartContainer>
							<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
								<div className="text-2xl font-semibold tracking-tight text-foreground">
									{formatCount(totalSales)}
								</div>
								<div className="text-xs text-muted-foreground">vendas</div>
							</div>
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
											{formatCount(item.salesCount)}
										</div>
									</div>
									<div className="mt-1 text-right text-xs text-muted-foreground">
										{formatAmountFromCents(item.grossAmount)}
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
						left.partnerName.localeCompare(right.partnerName, "pt-BR"),
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
						<div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,500px)_1px_minmax(0,1fr)] xl:items-start">
							<div className="w-full max-w-[500px] justify-self-center xl:justify-self-start xl:pr-6">
								<div className="grid grid-cols-3 items-end gap-1.5">
									{[
										{
											rank: 2,
											partner: topThree[1] ?? null,
											pedestalClassName: "h-14",
										},
										{
											rank: 1,
											partner: topThree[0] ?? null,
											pedestalClassName: "h-20",
										},
										{
											rank: 3,
											partner: topThree[2] ?? null,
											pedestalClassName: "h-10",
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
												<div key={`podium-empty-${slot.rank}`} className="flex flex-col">
																<div
																	className={cn(
																		"relative flex items-center justify-center rounded-t-2xl",
																		pedestalGradientClass,
																		slot.pedestalClassName,
																	)}
																>
																	<span className={cn(
																		"font-bungee text-base font-black tabular-nums tracking-wide",
																		pedestalLabelClass,
																	)}>
																		{slot.rank}
																	</span>
																</div>
											</div>
										);
									}

										const totalSoldAmount =
											partner.salesBreakdown.concluded.grossAmount +
											partner.salesBreakdown.pending.grossAmount;

												return (
													<div key={partner.partnerId} className="flex flex-col">
															<div className="rounded-t-2xl p-2 text-center min-h-[170px] flex flex-col">
															<div className="relative mx-auto mt-1">
															<Avatar className="size-13 border-2 border-background shadow-sm">
																<AvatarFallback
																	className={cn(
																		"text-sm font-semibold",
																		avatarGradientClass,
																		avatarLabelClass,
																	)}
																>
																	{getInitials(partner.partnerName)}
																</AvatarFallback>
														</Avatar>
														</div>

														<div className="mt-1 min-h-[26px] px-1 text-center text-[12px] leading-tight font-semibold text-foreground break-words">
															{partner.partnerName}
														</div>

															<div
																className="mt-auto pt-2 font-mono text-base font-medium tabular-nums leading-none tracking-tight text-foreground"
															>
																{formatAmountFromCents(totalSoldAmount)}
															</div>
												</div>
														<div
															className={cn(
																"relative flex items-center justify-center rounded-t-2xl",
																pedestalGradientClass,
																slot.pedestalClassName,
															)}
														>
															<span className={cn(
																"font-bungee text-base font-black tabular-nums tracking-wide",
																pedestalLabelClass,
															)}>
																{slot.rank}
															</span>
													</div>
											</div>
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
							<Table className="table-fixed">
								<TableBody className="[&_tr]:border-0">
									{soldPartners.map((partner, index) => {
										const rank = index + 1;
										const rowToneClass = "bg-transparent";
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
										return (
											<Fragment key={partner.partnerId}>
												<TableRow className={cn("border-0", rowToneClass)}>
													<TableCell className="w-10 whitespace-nowrap pb-1 pl-2 pr-2 pt-2 text-left align-middle">
														<span className="inline-flex h-8 items-center font-mono font-medium leading-none tabular-nums text-foreground">
															{String(rank).padStart(2, "0")}
														</span>
													</TableCell>
													<TableCell className="pb-1 pl-2 pr-3 pt-2">
														<div className="flex min-w-0 items-center gap-2">
															<Avatar className="size-8 border border-border/70">
																<AvatarFallback className="text-[11px] font-medium">
																	{getInitials(partner.partnerName)}
																</AvatarFallback>
															</Avatar>
															<span className="truncate font-medium text-foreground">
																{partner.partnerName}
															</span>
														</div>
													</TableCell>
														<TableCell
															className={cn(
																"w-[8.5rem] px-2 pb-1 pt-2 text-right font-mono text-[13px] tabular-nums sm:text-sm",
																productionHasValue
																	? "font-semibold text-foreground"
																	: "font-normal text-muted-foreground",
															)}
														>
															<div className="text-right leading-none">
																{formatAmountFromCents(productionAmount)}
															</div>
														</TableCell>
												</TableRow>
												<TableRow className={cn("border-0", rowToneClass)}>
													<TableCell className="py-0 pl-2 pr-1" />
													<TableCell colSpan={2} className="px-3 pb-2 pt-0">
															<div className="flex items-center gap-2">
																<Tooltip>
																	<TooltipTrigger asChild>
																		<button
																			type="button"
																			className="block w-full flex-1 cursor-help rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
																			aria-label={`Detalhes de produção de ${partner.partnerName}`}
																		>
																	<div className="h-1.5 overflow-hidden rounded-full bg-muted">
																				<div
																				className={cn(
																					"h-full rounded-full transition-[width]",
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
																			{partner.partnerName}
																		</div>
																		<div className="flex items-center justify-between gap-3">
																			<span className="text-background/80">Concluídas</span>
																			<span className="font-mono font-medium tabular-nums">
																				{formatAmountFromCents(
																					partner.salesBreakdown.concluded.grossAmount,
																				)}
																			</span>
																		</div>
																		<div className="flex items-center justify-between gap-3">
																			<span className="text-background/80">Processando</span>
																			<span className="font-mono font-medium tabular-nums">
																				{formatAmountFromCents(
																					partner.salesBreakdown.pending.grossAmount,
																				)}
																			</span>
																		</div>
																		<div className="flex items-center justify-between gap-3">
																			<span className="text-background/80">Canceladas</span>
																			<span className="font-mono font-medium tabular-nums">
																				{formatAmountFromCents(
																					partner.salesBreakdown.canceled.grossAmount,
																				)}
																			</span>
																		</div>
																</TooltipContent>
															</Tooltip>
															{productionShare >= 100 ? (
																<span className="inline-flex w-[4.5rem] shrink-0 items-center justify-end gap-1 text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
																	<TrendingUp className="size-3" />
																	{formatSharePercentage(productionShare)}
																</span>
															) : (
																<span className="inline-flex w-[4.5rem] shrink-0 items-center justify-end gap-1 text-[11px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
																	<Minus className="size-3" />
																	{formatSharePercentage(productionShare)}
																</span>
															)}
														</div>
													</TableCell>
												</TableRow>
											</Fragment>
											);
										})}
									</TableBody>
							</Table>
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
	const [openSupervisors, setOpenSupervisors] = useState<Record<string, boolean>>(
		{},
	);

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
			const totalTrackedAmount = concludedAmount + pendingAmount + canceledAmount;
			const totalTrackedCount = concludedCount + pendingCount + canceledCount;

			const supervisorId = partner.supervisor?.id ?? "UNASSIGNED";
			const supervisorName =
				partner.supervisor?.name?.trim() || "Sem supervisor";
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
					Produção agregada por supervisor no período filtrado, com
					canceladas do mês anterior.
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
								const partners = [...supervisor.partners]
									.sort(
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
										left.partnerName.localeCompare(right.partnerName, "pt-BR"),
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
											<div className="overflow-x-auto p-2">
												<Table className="min-w-[860px]">
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
																partner.salesBreakdown.concluded.grossAmount > 0 ||
																partner.salesBreakdown.concluded.salesCount > 0;
															const pendingHasValue =
																partner.salesBreakdown.pending.grossAmount > 0 ||
																partner.salesBreakdown.pending.salesCount > 0;
															const delinquentHasValue =
																partner.delinquentGrossAmount > 0 ||
																partner.delinquentSalesCount > 0;
															const canceledHasValue =
																canceledMetrics.grossAmount > 0 ||
																canceledMetrics.salesCount > 0;

															return (
																<TableRow
																	key={partner.partnerId}
																	className="bg-transparent hover:bg-muted/20"
																>
																<TableCell className="px-3 py-3">
																	<div className="flex min-w-0 items-center gap-3">
																		<Avatar className="size-7 border border-border/70">
																			<AvatarFallback className="text-[10px] font-medium">
																				{getInitials(partner.partnerName)}
																			</AvatarFallback>
																		</Avatar>
																		<span className="truncate font-medium text-foreground">
																			{partner.partnerName}
																		</span>
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
																					partner.salesBreakdown.concluded.grossAmount,
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
																					partner.salesBreakdown.concluded.salesCount,
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
																					partner.salesBreakdown.pending.grossAmount,
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
																					partner.salesBreakdown.pending.salesCount,
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
																				{formatAmountFromCents(partner.delinquentGrossAmount)}
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
																				{formatCount(partner.delinquentSalesCount)}
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
							>
								{pieData.map((entry) => (
									<Cell
										key={`${entry.status}-${entry.fill}`}
										fill={entry.fill}
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
	summary,
}: {
	summary: PartnerDashboardData["summary"] | undefined;
}) {
	const incomePaidAmount = summary?.commissionReceivedAmount ?? 0;
	const incomePendingAmount = summary?.commissionPendingAmount ?? 0;
	const incomeTotalAmount = incomePaidAmount + incomePendingAmount;
	const outcomePaidAmount = Math.max(
		incomePaidAmount - (summary?.netRevenueAmount ?? 0),
		0,
	);

	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Comissões por competência</CardTitle>
				<CardDescription>
					Parcelas previstas no mês, separadas entre receber e pagar.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<PartnerCommissionDirectionPanel
					title="A receber"
					totalAmount={incomeTotalAmount}
					pendingAmount={incomePendingAmount}
					paidAmount={incomePaidAmount}
					canceledAmount={0}
					intent="income"
				/>
				<PartnerCommissionDirectionPanel
					title="A pagar"
					totalAmount={outcomePaidAmount}
					pendingAmount={0}
					paidAmount={outcomePaidAmount}
					canceledAmount={0}
					intent="outcome"
				/>
			</CardContent>
		</Card>
	);
}

function DelinquencyBreakdownCard({
	totalSales,
	buckets,
}: {
	totalSales: number;
	buckets: PartnerDashboardData["delinquencyBreakdown"]["buckets"];
}) {
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
					Faixas de atraso das vendas de parceiros atualmente inadimplentes.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-2">
					<div className="rounded-xl border bg-muted/20 p-3">
						<div className="text-xs text-muted-foreground">
							Vendas inadimplentes
						</div>
						<div className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
							{formatCount(totalSales)}
						</div>
					</div>
					<div className="rounded-xl border bg-muted/20 p-3 text-right">
						<div className="text-xs text-muted-foreground">Produção em risco</div>
						<div className="mt-1 text-sm font-semibold text-foreground">
							{formatAmountFromCents(totalDelinquentAmount)}
						</div>
					</div>
				</div>
				{pieDataWithSales.length === 0 ? (
					<div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
						Sem inadimplência no período selecionado.
					</div>
				) : (
					<div className="space-y-4">
						<div className="relative mx-auto w-full max-w-[260px]">
							<ChartContainer
								config={delinquencyChartConfig}
								className="h-[230px] w-full"
							>
								<PieChart>
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
																	Vendas
																</span>
																<span className="font-mono font-medium tabular-nums text-foreground">
																	{formatCount(Number(value))}
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
										dataKey="salesCount"
										nameKey="label"
										innerRadius={56}
										outerRadius={92}
										paddingAngle={2}
									>
										{pieDataWithSales.map((entry) => (
											<Cell
												key={`${entry.key}-${entry.fill}`}
												fill={entry.fill}
											/>
										))}
									</Pie>
								</PieChart>
							</ChartContainer>
							<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
								<div className="text-2xl font-semibold tracking-tight text-foreground">
									{formatCount(totalSales)}
								</div>
								<div className="text-xs text-muted-foreground">vendas</div>
							</div>
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
											{formatCount(item.salesCount)}
										</div>
										<div className="text-[11px] text-muted-foreground">
											{formatAmountFromCents(item.grossAmount)}
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

	const defaultStartDate = useMemo(() => getDefaultStartDate(), []);
	const defaultEndDate = useMemo(() => getDefaultEndDate(), []);
	const effectiveStartDate =
		isValidDateFilterInput(startDate) ? startDate : defaultStartDate;
	const effectiveEndDate =
		isValidDateFilterInput(endDate) ? endDate : defaultEndDate;
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
		dynamicFieldId: effectiveDynamicFieldId || undefined,
		productBreakdownDepth,
	});
	const previousMonthCanceledQuery = usePartnerSalesDashboard({
		startDate: previousMonthCanceledDateRange.startDate,
		endDate: previousMonthCanceledDateRange.endDate,
		inactiveMonths,
		supervisorId: effectiveSupervisorId || undefined,
		partnerIds: effectivePartnerIdsCsv,
		dynamicFieldId: effectiveDynamicFieldId || undefined,
		productBreakdownDepth,
	});
	const data = query.data;
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

		return allPartners.filter(
			(partner) => partner.supervisorId === effectiveSupervisorId,
		);
	}, [data?.filters.partners, effectiveSupervisorId]);

	useEffect(() => {
		const allowedIds = new Set(partnerOptions.map((partner) => partner.id));
		const sanitizedIds = selectedPartnerIds.filter((id) => allowedIds.has(id));
		if (sanitizedIds.length === selectedPartnerIds.length) {
			return;
		}

		void setPartnerIdsCsv(serializePartnerIdsCsv(sanitizedIds));
	}, [partnerOptions, selectedPartnerIds, setPartnerIdsCsv]);

	useEffect(() => {
		if (!data) {
			return;
		}

		const nextDynamicFieldId = data.dynamicFieldBreakdown.selectedFieldId ?? "";
		if (dynamicFieldId === nextDynamicFieldId) {
			return;
		}

		void setDynamicFieldId(nextDynamicFieldId);
	}, [data, dynamicFieldId, setDynamicFieldId]);

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
				amount: item.grossAmount / 100,
				salesCount: item.salesCount,
			})),
		[data?.timeline],
	);
	const timelineDailyPeakAmount = useMemo(
		() =>
			Math.max(
				...(data?.timeline ?? []).map((item) => item.grossAmount),
				0,
			),
		[data?.timeline],
	);
	const timelineDaysWithSales = useMemo(
		() =>
			(data?.timeline ?? []).filter((item) => item.salesCount > 0).length,
		[data?.timeline],
	);
	const timelineGranularity = data?.period.timelineGranularity ?? "DAY";

	if (query.isLoading && !data) {
		return <DashboardPartnersSkeleton />;
	}

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
					<div className="space-y-2">
						<Label>Campo personalizado</Label>
						<Select
							value={data?.dynamicFieldBreakdown.selectedFieldId ?? "NONE"}
							disabled={
								!data || data.dynamicFieldBreakdown.availableFields.length === 0
							}
							onValueChange={(value) =>
								void setDynamicFieldId(value === "NONE" ? "" : value)
							}
						>
							<SelectTrigger className="w-full rounded-full">
								<SelectValue placeholder="Sem campos elegíveis" />
							</SelectTrigger>
							<SelectContent>
								{(data?.dynamicFieldBreakdown.availableFields ?? []).length ===
								0 ? (
									<SelectItem value="NONE">Sem campos elegíveis</SelectItem>
								) : (
									(data?.dynamicFieldBreakdown.availableFields ?? []).map(
										(field) => (
											<SelectItem key={field.fieldId} value={field.fieldId}>
												{field.label}
											</SelectItem>
										),
									)
								)}
							</SelectContent>
						</Select>
					</div>
				</FilterPanel>
			) : null}

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
						<CardTitle>
							{timelineGranularity === "DAY"
								? "Vendas por dia"
								: "Faturamento por mês"}
						</CardTitle>
						<CardDescription>
							Vendas válidas no período filtrado, sem considerar vendas
							canceladas.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4 pt-6">
						<ChartContainer
							config={timelineChartConfig}
							className="h-[290px] w-full"
						>
							<BarChart data={timelineChartData} barGap={6}>
								<CartesianGrid vertical={false} />
								<XAxis
									dataKey="label"
									tickLine={false}
									axisLine={false}
									minTickGap={10}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									tickFormatter={(value) => formatCurrencyBRL(Number(value))}
								/>
								<ChartTooltip
									content={
										<ChartTooltipContent
											labelFormatter={(_, payload) => {
												const item = payload?.[0]?.payload as
													| { label?: string }
													| undefined;
												return item?.label ?? "";
											}}
											formatter={(value) => (
												<div className="ml-auto font-medium">
													{formatCurrencyBRL(Number(value))}
												</div>
											)}
										/>
									}
								/>
								<Bar
									dataKey="amount"
									radius={[8, 8, 0, 0]}
									fill="var(--color-amount)"
								/>
							</BarChart>
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

				<PartnerSalesStatusCard
					items={data?.statusFunnel.items ?? []}
				/>
				<PartnerCommissionsByCompetencyCard
					summary={data?.summary}
				/>
			</div>

			<div className="space-y-6">
				<PartnerRankingSection items={data?.ranking ?? []} />
				<SupervisorRankingSection
					items={data?.ranking ?? []}
					canceledByPartnerId={previousMonthCanceledByPartnerId}
					hasPreviousMonthCanceledData={hasPreviousMonthCanceledData}
				/>
			</div>

			<div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-3">
				<PartnerBreakdownPieCard
					title={`Vendas por ${data?.dynamicFieldBreakdown.selectedFieldLabel ?? "campo personalizado"}`}
					description="Distribuição das vendas por valor do campo selecionado."
					items={data?.dynamicFieldBreakdown.items ?? []}
					emptyMessage="Nenhum valor preenchido para o campo selecionado neste período."
				/>

				<PartnerBreakdownPieCard
					title="Vendas por subproduto do produto pai"
					description={
						productBreakdownDepth === "ALL_LEVELS"
							? "Distribuição pelo caminho completo dos produtos usados nas vendas."
							: "Distribuição apenas pelo primeiro nível abaixo do produto pai."
					}
					items={data?.productBreakdown.items ?? []}
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

				<DelinquencyBreakdownCard
					totalSales={data?.delinquencyBreakdown.totalSales ?? 0}
					buckets={data?.delinquencyBreakdown.buckets ?? []}
				/>
			</div>
		</section>
	);
}
