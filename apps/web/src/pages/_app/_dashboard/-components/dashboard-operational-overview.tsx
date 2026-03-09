import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useApp } from "@/context/app-context";
import {
	useGetOrganizationsSlugCategories,
	useGetOrganizationsSlugCompanies,
	useGetOrganizationsSlugCostcenters,
	useGetOrganizationsSlugCustomers,
	useGetOrganizationsSlugEmployees,
	useGetOrganizationsSlugPartners,
	useGetOrganizationsSlugSellers,
} from "@/http/generated";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import {
	Activity,
	ArrowRight,
	BriefcaseBusiness,
	Building2,
	ChartNoAxesColumn,
	FolderTree,
	Users,
	UserRound,
	UserRoundCheck,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

export function DashboardOperationalOverview() {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	const customersQuery = useGetOrganizationsSlugCustomers({ slug });
	const sellersQuery = useGetOrganizationsSlugSellers({ slug });
	const partnersQuery = useGetOrganizationsSlugPartners({ slug });
	const employeesQuery = useGetOrganizationsSlugEmployees({ slug });
	const companiesQuery = useGetOrganizationsSlugCompanies({ slug });
	const categoriesQuery = useGetOrganizationsSlugCategories({ slug });
	const costCentersQuery = useGetOrganizationsSlugCostcenters({ slug });

	if (!organization) {
		return null;
	}

	const customers = customersQuery.data?.customers ?? [];
	const sellers = sellersQuery.data?.sellers ?? [];
	const partners = partnersQuery.data?.partners ?? [];
	const employees = employeesQuery.data?.employees ?? [];
	const companies = companiesQuery.data?.companies ?? [];
	const categories = categoriesQuery.data?.categories ?? [];
	const costCenters = costCentersQuery.data?.costCenters ?? [];

	const summary = {
		customersTotal: customers.length,
		customersActive: customers.filter((item) => item.status === "ACTIVE").length,
		relationshipsTotal: sellers.length + partners.length,
		relationshipsActive:
			sellers.filter((item) => item.status === "ACTIVE").length +
			partners.filter((item) => item.status === "ACTIVE").length,
		teamTotal: employees.length,
		companiesTotal: companies.length,
		unitsTotal: companies.reduce((acc, company) => acc + company.units.length, 0),
		categoriesTotal: categories.length,
		categoryChildrenTotal: categories.reduce(
			(acc, category) => acc + category.children.length,
			0,
		),
		costCentersTotal: costCenters.length,
	};

	const customersPf = customers.filter((item) => item.personType === "PF").length;
	const customersPj = customers.filter((item) => item.personType === "PJ").length;
	const customersWithEmail = customers.filter((item) => !!item.email).length;
	const customersWithPhone = customers.filter((item) => !!item.phone).length;
	const contactCoverage =
		customers.length === 0
			? 0
			: Math.round(((customersWithEmail + customersWithPhone) / (customers.length * 2)) * 100);

	const chartData = [
		{
			entity: "Clientes",
			active: customers.filter((item) => item.status === "ACTIVE").length,
			inactive: customers.filter((item) => item.status === "INACTIVE").length,
		},
		{
			entity: "Vendedores",
			active: sellers.filter((item) => item.status === "ACTIVE").length,
			inactive: sellers.filter((item) => item.status === "INACTIVE").length,
		},
		{
			entity: "Parceiros",
			active: partners.filter((item) => item.status === "ACTIVE").length,
			inactive: partners.filter((item) => item.status === "INACTIVE").length,
		},
	];

	const chartConfig = {
		active: { label: "Ativos", color: "hsl(142 72% 40%)" },
		inactive: { label: "Inativos", color: "hsl(0 72% 51%)" },
	} satisfies ChartConfig;

	const departmentRows = Object.entries(
		employees.reduce<Record<string, number>>((acc, employee) => {
			const key = employee.department?.trim() || "Sem departamento";
			acc[key] = (acc[key] ?? 0) + 1;
			return acc;
		}, {}),
	)
		.map(([name, total]) => ({ name, total }))
		.sort((a, b) => b.total - a.total)
		.slice(0, 6);

	const companyRows = [...companies]
		.map((company) => ({
			id: company.id,
			name: company.name,
			units: company.units.length,
			employees: company.employees.length,
		}))
		.sort((a, b) => b.employees - a.employees || b.units - a.units)
		.slice(0, 5);

	const categoryOverview = [
		{
			label: "Receitas",
			value: categories.filter((item) => item.type === "INCOME").length,
			color: "#0ea5e9",
		},
		{
			label: "Despesas",
			value: categories.filter((item) => item.type === "OUTCOME").length,
			color: "#f97316",
		},
	];

	const topCustomers = [...customers]
		.sort((a, b) => a.name.localeCompare(b.name))
		.slice(0, 6);

	return (
		<div className="space-y-6">
			<section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
				<SummaryCard
					title="Clientes"
					value={summary.customersTotal}
					subtitle={`${summary.customersActive} ativos`}
					icon={Users}
					tone="emerald"
				/>
				<SummaryCard
					title="Vendedores + Parceiros"
					value={summary.relationshipsTotal}
					subtitle={`${summary.relationshipsActive} ativos`}
					icon={UserRoundCheck}
					tone="blue"
				/>
				<SummaryCard
					title="Equipe"
					value={summary.teamTotal}
					subtitle={`${summary.companiesTotal} empresa(s) / ${summary.unitsTotal} unidade(s)`}
					icon={BriefcaseBusiness}
					tone="amber"
				/>
				<SummaryCard
					title="Estrutura Financeira"
					value={summary.categoriesTotal + summary.costCentersTotal}
					subtitle={`${summary.categoriesTotal} categorias • ${summary.costCentersTotal} centros`}
					icon={FolderTree}
					tone="rose"
				/>
			</section>

			<section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.65fr_1fr]">
				<Card className="overflow-hidden border-slate-200/70 p-0">
					<CardHeader className="border-b bg-linear-to-r from-slate-50 to-emerald-50/60 px-6 py-0 pt-6">
						<CardTitle className="flex items-center gap-2">
							<ChartNoAxesColumn className="size-4 text-emerald-700" />
							Status por cadastro
						</CardTitle>
						<CardDescription>
							Distribuição de ativos e inativos em clientes, vendedores e parceiros.
						</CardDescription>
					</CardHeader>
					<CardContent className="pt-6">
						<ChartContainer config={chartConfig} className="h-[320px] w-full">
							<BarChart data={chartData} barGap={8}>
								<CartesianGrid vertical={false} />
								<XAxis dataKey="entity" tickLine={false} axisLine={false} />
								<YAxis allowDecimals={false} tickLine={false} axisLine={false} />
								<ChartTooltip content={<ChartTooltipContent />} />
								<ChartLegend content={<ChartLegendContent />} />
								<Bar dataKey="active" stackId="status" radius={[6, 6, 0, 0]} />
								<Bar dataKey="inactive" stackId="status" radius={[6, 6, 0, 0]} />
							</BarChart>
						</ChartContainer>
					</CardContent>
				</Card>

				<Card className="border-slate-200/70">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Activity className="size-4 text-slate-700" />
							Qualidade do cadastro
						</CardTitle>
						<CardDescription>
							Cobertura de contato e perfil dos clientes cadastrados.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						<div className="rounded-xl border bg-muted/30 p-4">
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Cobertura de contato</span>
								<span className="font-semibold">{contactCoverage}%</span>
							</div>
							<div className="mt-3 h-2 rounded-full bg-muted">
								<div
									className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
									style={{ width: `${contactCoverage}%` }}
								/>
							</div>
							<div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
								<div>Email: {customersWithEmail}/{customers.length}</div>
								<div>Telefone: {customersWithPhone}/{customers.length}</div>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<MiniStat
								label="Pessoa Física"
								value={customersPf}
								icon={UserRound}
								className="border-emerald-200 bg-emerald-50 text-emerald-900"
							/>
							<MiniStat
								label="Pessoa Jurídica"
								value={customersPj}
								icon={Building2}
								className="border-blue-200 bg-blue-50 text-blue-900"
							/>
						</div>

						<div className="space-y-2">
							<div className="text-sm font-medium">Cobertura operacional</div>
							<CoverageRow label="Categorias" current={summary.categoriesTotal} target={12} />
							<CoverageRow label="Centros de custo" current={summary.costCentersTotal} target={6} />
							<CoverageRow label="Unidades" current={summary.unitsTotal} target={4} />
						</div>
					</CardContent>
				</Card>
			</section>

			<section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1.2fr_1fr]">
				<Card className="border-slate-200/70">
					<CardHeader>
						<CardTitle>Estrutura empresarial</CardTitle>
						<CardDescription>
							Empresas com maior número de colaboradores e unidades.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Empresa</TableHead>
									<TableHead className="text-right">Unidades</TableHead>
									<TableHead className="text-right">Colab.</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{companyRows.length ? (
									companyRows.map((row) => (
										<TableRow key={row.id}>
											<TableCell className="font-medium">{row.name}</TableCell>
											<TableCell className="text-right">{row.units}</TableCell>
											<TableCell className="text-right">{row.employees}</TableCell>
										</TableRow>
									))
								) : (
									<TableRow>
										<TableCell colSpan={3} className="text-muted-foreground">
											Nenhuma empresa cadastrada.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				<Card className="border-slate-200/70">
					<CardHeader>
						<CardTitle>Departamentos da equipe</CardTitle>
						<CardDescription>
							Distribuição dos colaboradores por departamento.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{departmentRows.length ? (
							departmentRows.map((department) => {
								const max = Math.max(...departmentRows.map((item) => item.total), 1);
								const width = Math.round((department.total / max) * 100);
								return (
									<div key={department.name} className="space-y-1.5">
										<div className="flex items-center justify-between text-sm">
											<span className="truncate pr-3">{department.name}</span>
											<span className="font-medium tabular-nums">{department.total}</span>
										</div>
										<div className="h-2 rounded-full bg-muted">
											<div
												className="h-2 rounded-full bg-gradient-to-r from-slate-900 to-slate-500"
												style={{ width: `${width}%` }}
											/>
										</div>
									</div>
								);
							})
						) : (
							<div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
								Ainda não há colaboradores cadastrados.
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="border-slate-200/70">
					<CardHeader>
						<CardTitle>Categorias financeiras</CardTitle>
						<CardDescription>
							Base de categorias e subcategorias da organização.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="mx-auto max-w-[220px]">
							<ChartContainer
								config={{
									value: { label: "Categorias" },
									receitas: { label: "Receitas", color: "#0ea5e9" },
									despesas: { label: "Despesas", color: "#f97316" },
								}}
								className="h-[200px]"
							>
								<PieChart>
									<ChartTooltip
										content={<ChartTooltipContent nameKey="label" labelKey="label" />}
									/>
									<Pie
										data={categoryOverview}
										dataKey="value"
										nameKey="label"
										innerRadius={48}
										outerRadius={72}
										paddingAngle={2}
									>
										{categoryOverview.map((entry) => (
											<Cell key={entry.label} fill={entry.color} />
										))}
									</Pie>
								</PieChart>
							</ChartContainer>
						</div>

						<div className="grid grid-cols-2 gap-3 text-sm">
							<div className="rounded-lg border bg-muted/30 p-3">
								<div className="text-muted-foreground">Categorias</div>
								<div className="mt-1 text-lg font-semibold">{summary.categoriesTotal}</div>
							</div>
							<div className="rounded-lg border bg-muted/30 p-3">
								<div className="text-muted-foreground">Subcategorias</div>
								<div className="mt-1 text-lg font-semibold">
									{summary.categoryChildrenTotal}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</section>

			<section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
				<Card className="border-slate-200/70">
					<CardHeader>
						<CardTitle>Clientes (amostra)</CardTitle>
						<CardDescription>
							Visão rápida dos primeiros clientes cadastrados e seu status.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-3 sm:grid-cols-2">
							{topCustomers.length ? (
								topCustomers.map((customer) => (
									<div
										key={customer.id}
										className="rounded-xl border bg-gradient-to-br from-white to-slate-50 p-4"
									>
										<div className="flex items-start justify-between gap-3">
											<div>
												<div className="font-medium leading-tight">{customer.name}</div>
												<div className="mt-1 text-xs text-muted-foreground">
													{customer.email || customer.phone || "Sem contato informado"}
												</div>
											</div>
											<Badge
												variant={customer.status === "ACTIVE" ? "default" : "secondary"}
												className={cn(
													customer.status === "ACTIVE"
														? "bg-emerald-600 text-white"
														: "bg-slate-200 text-slate-800",
												)}
											>
												{customer.status === "ACTIVE" ? "Ativo" : "Inativo"}
											</Badge>
										</div>
										<div className="mt-3 flex items-center gap-2 text-xs">
											<Badge variant="outline">{customer.personType}</Badge>
											<Badge variant="outline">{customer.documentType}</Badge>
										</div>
									</div>
								))
							) : (
								<div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground sm:col-span-2">
									Nenhum cliente cadastrado ainda.
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				<Card className="border-slate-200/70">
					<CardHeader>
						<CardTitle>Atalhos</CardTitle>
						<CardDescription>
							Ações rápidas para manter os cadastros atualizados.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<QuickLink
							to="/registers/customers"
							title="Clientes"
							description="Consultar e editar cadastro de clientes"
						/>
						<QuickLink
							to="/registers/sellers"
							title="Vendedores"
							description="Gerenciar responsáveis comerciais"
						/>
						<QuickLink
							to="/registers/partners"
							title="Parceiros"
							description="Acompanhar parceiros e supervisores"
						/>
						<QuickLink
							to="/settings/members"
							title="Membros"
							description="Convites e permissões da organização"
						/>
					</CardContent>
				</Card>
			</section>
		</div>
	);
}

type SummaryCardProps = {
	title: string;
	value: number;
	subtitle: string;
	icon: ComponentType<{ className?: string }>;
	tone: "emerald" | "blue" | "amber" | "rose";
};

function SummaryCard({ title, value, subtitle, icon: Icon, tone }: SummaryCardProps) {
	const toneClass = {
		emerald: "from-emerald-50 to-white border-emerald-100",
		blue: "from-blue-50 to-white border-blue-100",
		amber: "from-amber-50 to-white border-amber-100",
		rose: "from-rose-50 to-white border-rose-100",
	}[tone];

	const iconClass = {
		emerald: "bg-emerald-100 text-emerald-700",
		blue: "bg-blue-100 text-blue-700",
		amber: "bg-amber-100 text-amber-700",
		rose: "bg-rose-100 text-rose-700",
	}[tone];

	return (
		<Card className={cn("gap-4 border bg-gradient-to-br py-4", toneClass)}>
			<CardContent className="flex items-start justify-between px-4">
				<div>
					<div className="text-sm text-muted-foreground">{title}</div>
					<div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
					<div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
				</div>
				<div className={cn("rounded-lg p-2.5", iconClass)}>
					<Icon className="size-4" />
				</div>
			</CardContent>
		</Card>
	);
}

function CoverageRow({
	label,
	current,
	target,
}: {
	label: string;
	current: number;
	target: number;
}) {
	const percent = Math.min(100, Math.round((current / Math.max(target, 1)) * 100));
	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between text-xs">
				<span className="text-muted-foreground">{label}</span>
				<span className="font-medium tabular-nums">
					{current}/{target}
				</span>
			</div>
			<div className="h-1.5 rounded-full bg-muted">
				<div
					className="h-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
					style={{ width: `${percent}%` }}
				/>
			</div>
		</div>
	);
}

function MiniStat({
	label,
	value,
	icon: Icon,
	className,
}: {
	label: string;
	value: number;
	icon: ComponentType<{ className?: string }>;
	className?: string;
}) {
	return (
		<div className={cn("rounded-xl border p-3", className)}>
			<div className="flex items-center justify-between gap-2">
				<span className="text-xs font-medium">{label}</span>
				<Icon className="size-4 opacity-80" />
			</div>
			<div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
		</div>
	);
}

function QuickLink({
	to,
	title,
	description,
}: {
	to: "/registers/customers" | "/registers/sellers" | "/registers/partners" | "/settings/members";
	title: string;
	description: string;
}) {
	return (
		<Link
			to={to}
			className="group flex items-center justify-between rounded-xl border p-3 transition-colors hover:bg-muted/40"
		>
			<div>
				<div className="font-medium">{title}</div>
				<div className="text-xs text-muted-foreground">{description}</div>
			</div>
			<ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
		</Link>
	);
}
