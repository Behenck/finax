import { format, parse } from "date-fns";
import { Eye } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ResponsiveDataView } from "@/components/responsive-data-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { GetOrganizationsSlugCustomersCustomerid200 } from "@/http/generated";
import { formatCurrencyBRL } from "@/utils/format-amount";
import { SaleDelinquencyBadge } from "@/pages/_app/sales/-components/sale-delinquency-badge";
import { SaleStatusBadge } from "@/pages/_app/sales/-components/sale-status-badge";
import type { SaleStatus } from "@/schemas/types/sales";

interface CustomerSalesListProps {
	sales: GetOrganizationsSlugCustomersCustomerid200["customer"]["sales"];
}

function formatDate(value: string) {
	return format(parse(value.slice(0, 10), "yyyy-MM-dd", new Date()), "dd/MM/yyyy");
}

export function CustomerSalesList({ sales }: CustomerSalesListProps) {
	if (sales.length === 0) {
		return (
			<Card className="p-6 text-sm text-muted-foreground">
				Este cliente ainda não possui vendas visíveis.
			</Card>
		);
	}

	return (
		<ResponsiveDataView
			mobile={
				<div className="space-y-3">
					{sales.map((sale) => (
						<Card
							key={sale.id}
							className={`space-y-3 p-4 ${
								sale.delinquencySummary.hasOpen
									? "border-rose-500/30 bg-rose-500/5"
									: ""
							}`}
						>
							<div className="space-y-1">
								<p className="text-sm font-semibold">{sale.product.name}</p>
								<p className="text-xs text-muted-foreground">
									{sale.company.name}
									{sale.unit ? ` • ${sale.unit.name}` : ""}
								</p>
							</div>

							<div className="grid grid-cols-2 gap-2 text-xs">
								<div className="space-y-0.5">
									<p className="text-muted-foreground">Data da venda</p>
									<p>{formatDate(sale.saleDate)}</p>
								</div>
								<div className="space-y-0.5">
									<p className="text-muted-foreground">Valor</p>
									<p className="font-semibold">
										{formatCurrencyBRL(sale.totalAmount / 100)}
									</p>
								</div>
							</div>

							<div className="flex flex-wrap items-center gap-2">
								<SaleStatusBadge status={sale.status as SaleStatus} />
								<SaleDelinquencyBadge
									summary={sale.delinquencySummary}
									showOldestDueDate
								/>
							</div>

							{sale.openDelinquencies.length > 0 ? (
								<div className="rounded-md border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-800 dark:text-rose-200">
									<p className="font-medium">Vencimentos em aberto</p>
									<div className="mt-2 flex flex-wrap gap-2">
										{sale.openDelinquencies.map((occurrence) => (
											<span
												key={occurrence.id}
												className="rounded-full border border-rose-500/30 px-2 py-1"
											>
												{formatDate(occurrence.dueDate)}
											</span>
										))}
									</div>
								</div>
							) : null}

							<Button variant="outline" size="sm" asChild>
								<Link to="/sales/$saleId" params={{ saleId: sale.id }}>
									<Eye className="size-4" />
									Ver venda
								</Link>
							</Button>
						</Card>
					))}
				</div>
			}
			desktop={
				<div className="overflow-hidden rounded-md border bg-card">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Venda</TableHead>
								<TableHead>Empresa/Unidade</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Inadimplência</TableHead>
								<TableHead>Valor</TableHead>
								<TableHead></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{sales.map((sale) => (
								<TableRow key={sale.id}>
									<TableCell>
										<div className="space-y-1">
											<p className="font-medium">{sale.product.name}</p>
											<p className="text-xs text-muted-foreground">
												{formatDate(sale.saleDate)}
											</p>
										</div>
									</TableCell>
									<TableCell>
										<div className="space-y-1 text-sm">
											<p>{sale.company.name}</p>
											<p className="text-xs text-muted-foreground">
												{sale.unit?.name ?? "Sem unidade"}
											</p>
										</div>
									</TableCell>
									<TableCell>
										<SaleStatusBadge status={sale.status as SaleStatus} />
									</TableCell>
									<TableCell>
										{sale.delinquencySummary.hasOpen ? (
											<div className="space-y-2">
												<SaleDelinquencyBadge
													summary={sale.delinquencySummary}
													showOldestDueDate
												/>
												<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
													{sale.openDelinquencies.map((occurrence) => (
														<span key={occurrence.id}>{formatDate(occurrence.dueDate)}</span>
													))}
												</div>
											</div>
										) : (
											<span className="text-sm text-muted-foreground">-</span>
										)}
									</TableCell>
									<TableCell className="font-semibold">
										{formatCurrencyBRL(sale.totalAmount / 100)}
									</TableCell>
									<TableCell>
										<div className="flex justify-end">
											<Button variant="outline" size="sm" asChild>
												<Link to="/sales/$saleId" params={{ saleId: sale.id }}>
													<Eye className="size-4" />
													Ver venda
												</Link>
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			}
		/>
	);
}
