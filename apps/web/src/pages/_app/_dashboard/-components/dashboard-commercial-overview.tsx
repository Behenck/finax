import { formatCurrencyBRL } from "@/utils/format-amount";
import { type ComponentType, useEffect, useMemo } from "react";
import { useQueryState } from "nuqs";
import { Link } from "@tanstack/react-router";
import {
	BadgeDollarSign,
	BadgeAlert,
	BarChart3,
	CalendarClock,
	CircleDollarSign,
	Package,
	RefreshCcw,
	ShoppingCart,
	UserRoundCheck,
	Wallet,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { LoadingReveal } from "@/components/loading-reveal";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/context/app-context";
import { monthFilterParser } from "@/hooks/filters/parsers";
import { useSalesDashboard } from "@/hooks/sales";
import {
	type GetOrganizationsSlugProducts200,
	type GetOrganizationsSlugSalesDashboard200,
	useGetOrganizationsSlugProducts,
} from "@/http/generated";
import { cn } from "@/lib/utils";
import { DashboardMonthPicker } from "./dashboard-month-picker";
import {
	buildProductPathMap,
	buildDelta,
	formatCents,
	formatDayLabel,
	formatDeltaPercentage,
	formatMonthShortLabel,
	formatSignedCents,
	getPreviousMonthValue,
	normalizeMonthValue,
	type ProductTreeNode,
} from "./dashboard-commercial-utils";

type SalesDashboardData = GetOrganizationsSlugSalesDashboard200;
type SalesStatusKey = keyof SalesDashboardData["sales"]["byStatus"];
type CommissionDirectionKey = "INCOME" | "OUTCOME";

const SALES_STATUS_META: Record<
	SalesStatusKey,
	{ label: string; color: string; className: string }
> = {
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
};

const COMMISSION_STATUS_META = {
	total: {
		label: "Total",
		color: "from-slate-900 to-slate-500",
	},
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
		color: "hsl(161 84% 39%)",
	},
} satisfies ChartConfig;

const statusChartConfig = {
	value: {
		label: "Vendas",
	},
	PENDING: {
		label: SALES_STATUS_META.PENDING.label,
		color: SALES_STATUS_META.PENDING.color,
	},
	APPROVED: {
		label: SALES_STATUS_META.APPROVED.label,
		color: SALES_STATUS_META.APPROVED.color,
	},
	COMPLETED: {
		label: SALES_STATUS_META.COMPLETED.label,
		color: SALES_STATUS_META.COMPLETED.color,
	},
	CANCELED: {
		label: SALES_STATUS_META.CANCELED.label,
		color: SALES_STATUS_META.CANCELED.color,
	},
} satisfies ChartConfig;

export function DashboardCommercialOverview() {
	const { organization } = useApp();
	const [month, setMonth] = useQueryState("month", monthFilterParser);
	const effectiveMonth = normalizeMonthValue(month);
	const slug = organization?.slug ?? "";

	useEffect(() => {
		if (month !== effectiveMonth) {
			void setMonth(effectiveMonth);
		}
	}, [effectiveMonth, month, setMonth]);

	const query = useSalesDashboard(effectiveMonth);
	const productsQuery = useGetOrganizationsSlugProducts({ slug });
	const data = query.data;
	const previousMonthLabel = formatMonthShortLabel(
		getPreviousMonthValue(effectiveMonth),
	);
	const currentMonthLabel = formatMonthShortLabel(effectiveMonth);
	const productPathMap = useMemo(() => {
		const products =
			(productsQuery.data?.products as
				| GetOrganizationsSlugProducts200["products"]
				| undefined) ?? [];

		return buildProductPathMap(products as ProductTreeNode[]);
	}, [productsQuery.data?.products]);

	const isEmpty =
		data != null &&
		data.sales.current.count === 0 &&
		data.commissions.current.INCOME.total.count === 0 &&
		data.commissions.current.OUTCOME.total.count === 0;

	return (
		<section className="space-y-6">
			<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="space-y-2">
					<div>
						<h1 className="text-3xl font-semibold tracking-tight text-foreground">
							Vendas e comissões do mês
						</h1>
						<p className="max-w-3xl text-sm text-muted-foreground">
							Acompanhe o desempenho comercial por competência, compare com o
							mês anterior e acesse rapidamente os fluxos de vendas e comissões.
						</p>
					</div>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<DashboardMonthPicker
						value={effectiveMonth}
						onChange={(value) => void setMonth(value)}
						disabled={query.isLoading}
					/>
					<div className="flex gap-2">
						<Button asChild variant="outline" className="rounded-full">
							<Link to="/commissions">
								<Wallet className="size-4" />
								Comissões
							</Link>
						</Button>
						<Button asChild className="rounded-full">
							<Link to="/sales">
								<ShoppingCart className="size-4" />
								Vendas
							</Link>
						</Button>
					</div>
				</div>
			</header>

			{query.isError ? (
				<Card className="border-rose-500/30 bg-rose-500/10">
					<CardContent className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<div className="font-medium text-rose-700 dark:text-rose-300">
								Não foi possível carregar o dashboard comercial.
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
			) : (
				<LoadingReveal
					loading={query.isLoading}
					skeleton={<CommercialDashboardSkeleton />}
					contentKey={effectiveMonth}
					className="space-y-6"
					stagger
				>
					{data ? (
						<>
							{isEmpty ? (
								<Card className="border-dashed border-border bg-muted/20">
									<CardContent className="flex flex-col gap-4 py-8 lg:flex-row lg:items-center lg:justify-between">
										<div className="space-y-1">
											<div className="font-medium text-foreground">
												Sem movimento comercial em {currentMonthLabel}.
											</div>
											<p className="text-sm text-muted-foreground">
												Este período ainda não possui vendas nem parcelas de
												comissão com competência prevista.
											</p>
										</div>
										<div className="flex gap-2">
											<Button asChild variant="outline">
												<Link to="/commissions">Ver comissões</Link>
											</Button>
											<Button asChild>
												<Link to="/sales">Lançar vendas</Link>
											</Button>
										</div>
									</CardContent>
								</Card>
							) : null}

							<CommercialKpiGrid
								data={data}
								currentMonthLabel={currentMonthLabel}
								previousMonthLabel={previousMonthLabel}
							/>

							<div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr_1fr]">
								<TimelineCard data={data} />
								<SalesStatusCard data={data} />
								<CommissionsSummaryCard data={data} />
							</div>

							<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
								<TopProductsCard data={data} productPathMap={productPathMap} />
								<TopResponsiblesCard data={data} />
							</div>
						</>
					) : null}
				</LoadingReveal>
			)}
		</section>
	);
}

function CommercialKpiGrid({
	data,
	currentMonthLabel,
	previousMonthLabel,
}: {
	data: SalesDashboardData;
	currentMonthLabel: string;
	previousMonthLabel: string;
}) {
	return (
		<section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
			<KpiCard
				title="Vendas realizadas"
				value={data.sales.current.count}
				previousValue={data.sales.previous.count}
				icon={ShoppingCart}
				formatter={(value) => value.toLocaleString("pt-BR")}
				differenceFormatter={(value) =>
					`${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR")}`
				}
				helpText={`${currentMonthLabel} vs ${previousMonthLabel}`}
			/>
			<KpiCard
				title="Total de vendas"
				value={data.sales.current.grossAmount}
				previousValue={data.sales.previous.grossAmount}
				icon={CircleDollarSign}
				formatter={formatCents}
				differenceFormatter={formatSignedCents}
				helpText={`${currentMonthLabel} vs ${previousMonthLabel}`}
			/>
			<KpiCard
				title="Ticket médio"
				value={data.sales.current.averageTicket}
				previousValue={data.sales.previous.averageTicket}
				icon={BadgeDollarSign}
				formatter={formatCents}
				differenceFormatter={formatSignedCents}
				helpText={`${currentMonthLabel} vs ${previousMonthLabel}`}
			/>
			<StaticKpiCard
				title="Pré-cancelamento"
				value={data.sales.preCancellation.count.toLocaleString("pt-BR")}
				icon={BadgeAlert}
				helpText={
					data.sales.preCancellation.threshold === null
						? "Regra desativada"
						: `${data.sales.preCancellation.threshold}+ inadimplência(s) abertas`
				}
				intent="decrease"
			/>
			<KpiCard
				title="Comissões a receber"
				value={data.commissions.current.INCOME.total.amount}
				previousValue={data.commissions.previous.INCOME.total.amount}
				icon={Wallet}
				formatter={formatCents}
				differenceFormatter={formatSignedCents}
				helpText="Base pela data da venda"
			/>
			<KpiCard
				title="Comissões a pagar"
				value={data.commissions.current.OUTCOME.total.amount}
				previousValue={data.commissions.previous.OUTCOME.total.amount}
				icon={CalendarClock}
				formatter={formatCents}
				differenceFormatter={formatSignedCents}
				helpText="Base pela data da venda"
				intent="decrease"
			/>
			<KpiCard
				title="Saldo líquido previsto"
				value={data.commissions.current.netAmount}
				previousValue={data.commissions.previous.netAmount}
				icon={BarChart3}
				formatter={(value) =>
					`${value < 0 ? "-" : ""}${formatCents(Math.abs(value))}`
				}
				differenceFormatter={formatSignedCents}
				helpText="Receber menos pagar"
			/>
		</section>
	);
}

function StaticKpiCard({
	title,
	value,
	icon: Icon,
	helpText,
	intent = "increase",
}: {
	title: string;
	value: string;
	icon: ComponentType<{ className?: string }>;
	helpText: string;
	intent?: "increase" | "decrease";
}) {
	const toneClass =
		intent === "decrease"
			? "border-orange-500/30 bg-orange-500/10"
			: "border-border bg-background";
	const iconClass =
		intent === "decrease"
			? "bg-orange-600 text-white"
			: "bg-foreground text-background";

	return (
		<Card className={cn("border shadow-sm", toneClass)}>
			<CardContent className="space-y-4 p-5">
				<div className="flex items-center justify-between">
					<div className="text-sm text-muted-foreground">{title}</div>
					<div className={cn("rounded-xl p-2", iconClass)}>
						<Icon className="size-4" />
					</div>
				</div>

				<div className="space-y-1">
					<div className="text-2xl font-semibold tabular-nums text-foreground">
						{value}
					</div>
					<div className="text-xs text-muted-foreground">{helpText}</div>
				</div>
			</CardContent>
		</Card>
	);
}

function TimelineCard({ data }: { data: SalesDashboardData }) {
	const chartData = useMemo(
		() =>
			data.sales.timeline.map((item) => ({
				date: item.date,
				day: formatDayLabel(item.date),
				amount: item.amount / 100,
			})),
		[data.sales.timeline],
	);

	return (
		<Card className="overflow-hidden border-border/70">
			<CardHeader className="border-b bg-linear-to-r from-slate-50 to-emerald-50/60">
				<CardTitle>Faturamento por dia</CardTitle>
				<CardDescription>
					Vendas válidas do mês, sem considerar vendas canceladas.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4 pt-6">
				<ChartContainer
					config={timelineChartConfig}
					className="h-[290px] w-full"
				>
					<BarChart data={chartData} barGap={6}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="day"
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
											| { date?: string }
											| undefined;
										return item?.date?.slice(0, 10) ?? "";
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
					<CompactMetric
						label="Pico diário"
						value={formatCents(
							Math.round(
								Math.max(...data.sales.timeline.map((item) => item.amount), 0),
							),
						)}
					/>
					<CompactMetric
						label="Dias com venda"
						value={String(
							data.sales.timeline.filter((item) => item.count > 0).length,
						)}
					/>
				</div>
			</CardContent>
		</Card>
	);
}

function SalesStatusCard({ data }: { data: SalesDashboardData }) {
	const pieData = (
		Object.entries(data.sales.byStatus) as Array<
			[SalesStatusKey, SalesDashboardData["sales"]["byStatus"][SalesStatusKey]]
		>
	)
		.map(([status, summary]) => ({
			status,
			label: SALES_STATUS_META[status].label,
			value: summary.count,
			amount: summary.amount,
			fill: SALES_STATUS_META[status].color,
		}))
		.filter((item) => item.value > 0);

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
						config={statusChartConfig}
						className="h-[220px] w-[220px]"
					>
						<PieChart>
							<ChartTooltip
								content={
									<ChartTooltipContent
										nameKey="status"
										labelKey="label"
										formatter={(value, _name, item) => {
											const payload = item.payload as { amount: number };
											return (
												<div className="ml-auto text-right">
													<div className="font-medium">
														{Number(value)} venda(s)
													</div>
													<div className="text-muted-foreground">
														{formatCents(payload.amount)}
													</div>
												</div>
											);
										}}
									/>
								}
							/>
							<Pie
								cx="50%"
								cy="50%"
								data={
									pieData.length
										? pieData
										: [
												{
													status: "PENDING",
													label: "Sem vendas",
													value: 1,
													amount: 0,
													fill: "#cbd5e1",
												},
											]
								}
								dataKey="value"
								nameKey="status"
								innerRadius={50}
								outerRadius={82}
								paddingAngle={2}
							>
								{(pieData.length
									? pieData
									: [{ fill: "#cbd5e1", status: "PENDING" }]
								).map((entry) => (
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
					{(
						Object.entries(data.sales.byStatus) as Array<
							[
								SalesStatusKey,
								SalesDashboardData["sales"]["byStatus"][SalesStatusKey],
							]
						>
					).map(([status, summary]) => (
						<div
							key={status}
							className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
						>
							<div className="flex items-center gap-2">
								<span
									className="size-2.5 rounded-full"
									style={{ backgroundColor: SALES_STATUS_META[status].color }}
								/>
								<span className="text-sm">
									{SALES_STATUS_META[status].label}
								</span>
							</div>
							<div className="text-right text-sm">
								<div className="font-medium tabular-nums">{summary.count}</div>
								<div className="text-xs text-muted-foreground">
									{formatCents(summary.amount)}
								</div>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function CommissionsSummaryCard({ data }: { data: SalesDashboardData }) {
	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Comissões das vendas do período</CardTitle>
				<CardDescription>
					Parcelas geradas pelas vendas do mês, separadas entre receber e pagar.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<CommissionDirectionPanel
					title="A receber"
					direction="INCOME"
					summary={data.commissions.current.INCOME}
				/>
				<CommissionDirectionPanel
					title="A pagar"
					direction="OUTCOME"
					summary={data.commissions.current.OUTCOME}
				/>
			</CardContent>
		</Card>
	);
}

function TopProductsCard({
	data,
	productPathMap,
}: {
	data: SalesDashboardData;
	productPathMap: Map<string, string>;
}) {
	return (
		<Card className="border-border/70">
			<CardHeader className="flex flex-row items-center justify-between space-y-0">
				<div className="space-y-1">
					<CardTitle>Produtos em destaque</CardTitle>
					<CardDescription>Top 5 do mês por faturamento bruto.</CardDescription>
				</div>
				<Package className="size-5 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<RankingList
					items={data.sales.topProducts.map((item) => ({
						id: item.id,
						name: productPathMap.get(item.id) ?? item.name,
						meta: `${item.count} venda(s)`,
						amount: item.grossAmount,
					}))}
					emptyLabel="Nenhum produto com venda no período."
				/>
			</CardContent>
		</Card>
	);
}

function TopResponsiblesCard({ data }: { data: SalesDashboardData }) {
	return (
		<Card className="border-border/70">
			<CardHeader className="flex flex-row items-center justify-between space-y-0">
				<div className="space-y-1">
					<CardTitle>Responsáveis em destaque</CardTitle>
					<CardDescription>Top 5 do mês por faturamento bruto.</CardDescription>
				</div>
				<UserRoundCheck className="size-5 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<RankingList
					items={data.sales.topResponsibles.map((item) => ({
						id: `${item.type}-${item.id}`,
						name: item.name,
						meta: `${item.type === "SELLER" ? "Vendedor" : "Parceiro"} • ${item.count} venda(s)`,
						amount: item.grossAmount,
					}))}
					emptyLabel="Nenhum responsável com venda no período."
				/>
			</CardContent>
		</Card>
	);
}

function KpiCard({
	title,
	value,
	previousValue,
	icon: Icon,
	formatter,
	differenceFormatter,
	helpText,
	intent = "increase",
}: {
	title: string;
	value: number;
	previousValue: number;
	icon: ComponentType<{ className?: string }>;
	formatter: (value: number) => string;
	differenceFormatter: (value: number) => string;
	helpText: string;
	intent?: "increase" | "decrease";
}) {
	const delta = buildDelta(value, previousValue);
	const tone =
		delta.difference === 0
			? "slate"
			: intent === "increase"
				? delta.difference > 0
					? "emerald"
					: "rose"
				: delta.difference < 0
					? "emerald"
					: "rose";

	const toneClass = {
		slate: "border-border bg-background",
		emerald: "border-emerald-500/30 bg-emerald-500/10",
		rose: "border-rose-500/30 bg-rose-500/10",
	}[tone];

	const deltaClass = {
		slate: "text-muted-foreground",
		emerald: "text-emerald-700 dark:text-emerald-300",
		rose: "text-rose-700 dark:text-rose-300",
	}[tone];

	return (
		<Card className={cn("border shadow-sm", toneClass)}>
			<CardContent className="space-y-4 p-5">
				<div className="flex items-center justify-between">
					<div className="text-sm text-muted-foreground">{title}</div>
					<div className="rounded-xl bg-foreground p-2 text-background">
						<Icon className="size-4" />
					</div>
				</div>

				<div className="space-y-1">
					<div className="text-2xl font-semibold tabular-nums text-foreground">
						{formatter(value)}
					</div>
					<div className="text-xs text-muted-foreground">
						Anterior: {formatter(previousValue)}
					</div>
				</div>

				<div className="space-y-1">
					<div className={cn("text-xs font-medium", deltaClass)}>
						{delta.difference === 0
							? `sem variação • ${helpText}`
							: `${formatDeltaPercentage(delta.percentage)} • ${differenceFormatter(
									delta.difference,
								)}`}
					</div>
					<div className="text-xs text-muted-foreground">{helpText}</div>
				</div>
			</CardContent>
		</Card>
	);
}

function CommissionDirectionPanel({
	title,
	direction,
	summary,
}: {
	title: string;
	direction: CommissionDirectionKey;
	summary: SalesDashboardData["commissions"]["current"][CommissionDirectionKey];
}) {
	const isIncome = direction === "INCOME";
	const tone = isIncome
		? "border-emerald-500/30 bg-emerald-500/10"
		: "border-amber-500/30 bg-amber-500/10";

	return (
		<div className={cn("rounded-2xl border p-4", tone)}>
			<div className="mb-4 flex items-start justify-between gap-3">
				<div>
					<div className="text-sm font-medium text-foreground">{title}</div>
					<div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
						{formatCents(summary.total.amount)}
					</div>
				</div>
				<Badge
					variant="outline"
					className={cn(
						"rounded-full",
						isIncome
							? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
							: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
					)}
				>
					{summary.total.count} parcela(s)
				</Badge>
			</div>

			<div className="space-y-3">
				{(
					Object.entries(COMMISSION_STATUS_META) as Array<
						[
							keyof SalesDashboardData["commissions"]["current"][CommissionDirectionKey],
							(typeof COMMISSION_STATUS_META)[keyof typeof COMMISSION_STATUS_META],
						]
					>
				).map(([key, meta]) => {
					const bucket = summary[key];
					const width =
						summary.total.amount === 0
							? 0
							: Math.round((bucket.amount / summary.total.amount) * 100);

					return (
						<div key={key} className="space-y-1.5">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">{meta.label}</span>
								<span className="font-medium tabular-nums">
									{bucket.count} • {formatCents(bucket.amount)}
								</span>
							</div>
							<div className="h-2 rounded-full bg-background/80">
								<div
									className={cn(
										"h-2 rounded-full bg-gradient-to-r",
										meta.color,
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

function RankingList({
	items,
	emptyLabel,
}: {
	items: Array<{
		id: string;
		name: string;
		meta: string;
		amount: number;
	}>;
	emptyLabel: string;
}) {
	if (!items.length) {
		return (
			<div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
				{emptyLabel}
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{items.map((item, index) => (
				<div
					key={item.id}
					className="flex items-center justify-between rounded-xl border bg-background p-3"
				>
					<div className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
							{index + 1}
						</div>
						<div>
							<div className="font-medium text-foreground">{item.name}</div>
							<div className="text-xs text-muted-foreground">{item.meta}</div>
						</div>
					</div>
					<div className="text-right text-sm font-medium tabular-nums text-foreground">
						{formatCents(item.amount)}
					</div>
				</div>
			))}
		</div>
	);
}

function CompactMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border bg-muted/20 p-3">
			<div className="text-xs text-muted-foreground">{label}</div>
			<div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
		</div>
	);
}

function CommercialDashboardSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
				{Array.from({ length: 6 }).map((_, index) => (
					<Card key={`kpi-skeleton-${index}`}>
						<CardContent className="space-y-4 p-5">
							<div className="flex items-center justify-between">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="size-9 rounded-xl" />
							</div>
							<div className="space-y-2">
								<Skeleton className="h-8 w-32" />
								<Skeleton className="h-3 w-24" />
							</div>
							<Skeleton className="h-3 w-36" />
						</CardContent>
					</Card>
				))}
			</div>

			<div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr_1fr]">
				{Array.from({ length: 3 }).map((_, index) => (
					<Card key={`chart-skeleton-${index}`}>
						<CardContent className="space-y-4 p-6">
							<Skeleton className="h-5 w-40" />
							<Skeleton className="h-[260px] w-full" />
						</CardContent>
					</Card>
				))}
			</div>

			<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
				{Array.from({ length: 2 }).map((_, index) => (
					<Card key={`ranking-skeleton-${index}`}>
						<CardContent className="space-y-3 p-6">
							<Skeleton className="h-5 w-40" />
							{Array.from({ length: 4 }).map((__, rowIndex) => (
								<Skeleton
									key={`ranking-skeleton-row-${index}-${rowIndex}`}
									className="h-14 w-full"
								/>
							))}
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
