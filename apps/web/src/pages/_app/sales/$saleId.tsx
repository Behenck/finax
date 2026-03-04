import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format, parse, parseISO } from "date-fns";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDeleteSale, useSale } from "@/hooks/sales";
import {
	SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
	SALE_COMMISSION_SOURCE_TYPE_LABEL,
	SALE_RESPONSIBLE_TYPE_LABEL,
} from "@/schemas/types/sales";
import { formatCurrencyBRL } from "@/utils/format-amount";
import { SaleStatusBadge } from "./-components/sale-status-badge";

export const Route = createFileRoute("/_app/sales/$saleId")({
	component: SaleDetailsPage,
});

function formatSaleDate(value: string) {
	const dateOnly = value.slice(0, 10);
	return format(parse(dateOnly, "yyyy-MM-dd", new Date()), "dd/MM/yyyy");
}

function formatDateTime(value: string) {
	return format(parseISO(value), "dd/MM/yyyy HH:mm");
}

function SaleDetailsPage() {
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const { saleId } = Route.useParams();
	const navigate = useNavigate();
	const { data, isLoading, isError } = useSale(saleId);
	const { mutateAsync: deleteSale, isPending: isDeletingSale } =
		useDeleteSale();

	async function handleDeleteSale() {
		try {
			await deleteSale({
				saleId,
			});
			await navigate({
				to: "/sales",
			});
		} catch {
			// erro tratado no hook
		}
	}

	if (isLoading) {
		return (
			<Card className="p-6">
				<span className="text-muted-foreground">Carregando venda...</span>
			</Card>
		);
	}

	if (isError || !data?.sale) {
		return (
			<Card className="p-6">
				<span className="text-destructive">
					Não foi possível carregar a venda.
				</span>
			</Card>
		);
	}

	const { sale } = data;

	return (
		<main className="w-full space-y-6">
			<header className="flex items-center justify-between">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold">Detalhes da Venda</h1>
					<span className="text-muted-foreground text-sm">
						Código da venda: {sale.id}
					</span>
				</div>

				<div className="flex items-center gap-2">
					<Button variant="outline" asChild>
						<Link to="/sales">
							<ArrowLeft className="size-4" />
							Voltar
						</Link>
					</Button>
					<Button variant="outline" asChild>
						<Link to="/sales/update/$saleId" params={{ saleId: sale.id }}>
							<Pencil className="size-4" />
							Editar
						</Link>
					</Button>
					<Button
						variant="destructive"
						onClick={() => setDeleteDialogOpen(true)}
						disabled={isDeletingSale}
					>
						<Trash2 className="size-4" />
						Excluir
					</Button>
				</div>
			</header>

			<Card className="p-6 grid gap-4 md:grid-cols-3">
				<div className="space-y-1">
					<p className="text-muted-foreground text-sm">Data da venda</p>
					<p className="font-semibold">{formatSaleDate(sale.saleDate)}</p>
				</div>
				<div className="space-y-1">
					<p className="text-muted-foreground text-sm">Valor total</p>
					<p className="font-semibold">
						{formatCurrencyBRL(sale.totalAmount / 100)}
					</p>
				</div>
				<div className="space-y-1">
					<p className="text-muted-foreground text-sm">Status</p>
					<SaleStatusBadge status={sale.status} />
				</div>
			</Card>

			<div className="grid gap-4 md:grid-cols-2">
				<Card className="p-6 space-y-3">
					<h2 className="font-semibold">Relacionamentos</h2>
					<div className="space-y-2 text-sm">
						<p>
							<strong>Cliente:</strong> {sale.customer.name}
						</p>
						<p>
							<strong>Produto:</strong> {sale.product.name}
						</p>
						<p>
							<strong>Empresa:</strong> {sale.company.name}
						</p>
						<p>
							<strong>Unidade:</strong> {sale.unit?.name ?? "Sem unidade"}
						</p>
					</div>
				</Card>

				<Card className="p-6 space-y-3">
					<h2 className="font-semibold">Responsável</h2>
					<div className="space-y-2 text-sm">
						<p>
							<strong>Tipo:</strong>{" "}
							{SALE_RESPONSIBLE_TYPE_LABEL[sale.responsibleType]}
						</p>
						<p>
							<strong>Nome:</strong> {sale.responsible?.name ?? "Não informado"}
						</p>
					</div>
				</Card>
			</div>

			<Card className="p-6 space-y-3">
				<h2 className="font-semibold">Comissões da venda</h2>

				{sale.commissions.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Sem comissões cadastradas.
					</p>
				) : (
					<div className="space-y-3">
						{sale.commissions.map((commission) => (
							<div
								key={commission.id}
								className="rounded-md border p-3 text-sm"
							>
								<div className="flex items-center justify-between gap-3">
									<p className="font-medium">
										{SALE_COMMISSION_SOURCE_TYPE_LABEL[commission.sourceType]} •{" "}
										{
											SALE_COMMISSION_RECIPIENT_TYPE_LABEL[
												commission.recipientType
											]
										}
									</p>
									<p className="font-semibold">{commission.totalPercentage}%</p>
								</div>
								<p className="text-muted-foreground text-xs">
									Beneficiário:{" "}
									{commission.beneficiaryLabel ??
										commission.beneficiaryId ??
										"Não informado"}
								</p>
								<p className="text-muted-foreground text-xs">
									Parcelas:{" "}
									{commission.installments
										.map(
											(installment) =>
												`${installment.installmentNumber}ª ${installment.percentage}%`,
										)
										.join(" • ")}
								</p>
							</div>
						))}
					</div>
				)}
			</Card>

			<Card className="p-6 space-y-3">
				<h2 className="font-semibold">Auditoria</h2>
				<div className="space-y-2 text-sm">
					<p>
						<strong>Criado por:</strong> {sale.createdBy.name ?? "Sem nome"}
					</p>
					<p>
						<strong>Criado em:</strong> {formatDateTime(sale.createdAt)}
					</p>
					<p>
						<strong>Atualizado em:</strong> {formatDateTime(sale.updatedAt)}
					</p>
				</div>
			</Card>

			<Card className="p-6 space-y-3">
				<h2 className="font-semibold">Observação</h2>
				<p className="text-sm text-muted-foreground">
					{sale.notes ?? "Sem observações."}
				</p>
			</Card>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir venda</AlertDialogTitle>
						<AlertDialogDescription>
							Tem certeza que deseja excluir esta venda? Esta ação não pode ser
							desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeletingSale}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={handleDeleteSale}
							disabled={isDeletingSale}
						>
							{isDeletingSale ? "Excluindo..." : "Excluir venda"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</main>
	);
}
