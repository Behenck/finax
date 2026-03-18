import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format, parse, parseISO } from "date-fns";
import {
	ArrowLeft,
	CheckCircle2,
	FilePenLine,
	Pencil,
	PlusCircle,
	Trash2,
	WalletCards,
	type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApp } from "@/context/app-context";
import { useDeleteSale, useSale, useSaleHistory } from "@/hooks/sales";
import { useGetOrganizationsSlugProducts } from "@/http/generated";
import {
	SALE_COMMISSION_DIRECTION_LABEL,
	SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
	SALE_COMMISSION_SOURCE_TYPE_LABEL,
	SALE_RESPONSIBLE_TYPE_LABEL,
	type SaleStatus,
} from "@/schemas/types/sales";
import { formatCurrencyBRL } from "@/utils/format-amount";
import {
	SALE_HISTORY_ACTION_LABEL,
	type SaleHistoryEvent,
	toSaleHistoryTimelineEvent,
} from "./-components/sale-history-presenter";
import { formatSaleDynamicFieldValue } from "./-components/sale-dynamic-fields";
import { SaleStatusBadge } from "./-components/sale-status-badge";
import { SaleStatusAction } from "./-components/sale-status-action";

type ProductTreeNode = {
	id: string;
	name: string;
	children?: ProductTreeNode[];
};

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

function formatCommissionPercentage(value: number) {
	return `${new Intl.NumberFormat("pt-BR", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 4,
	}).format(value)}%`;
}

function buildProductPathMap(
	nodes: ProductTreeNode[],
	parentPath: string[] = [],
	map = new Map<string, string>(),
) {
	for (const node of nodes) {
		const currentPath = [...parentPath, node.name];
		map.set(node.id, currentPath.join(" -> "));

		const children = Array.isArray(node.children) ? node.children : [];
		buildProductPathMap(children, currentPath, map);
	}

	return map;
}

const SALE_HISTORY_ACTION_ICON: Record<SaleHistoryEvent["action"], LucideIcon> =
	{
		CREATED: PlusCircle,
		UPDATED: FilePenLine,
		STATUS_CHANGED: CheckCircle2,
		COMMISSION_INSTALLMENT_UPDATED: WalletCards,
		COMMISSION_INSTALLMENT_STATUS_UPDATED: CheckCircle2,
		COMMISSION_INSTALLMENT_DELETED: Trash2,
	};

const SALE_HISTORY_ACTION_ICON_CLASS: Record<
	SaleHistoryEvent["action"],
	string
> = {
	CREATED: "bg-emerald-50 text-emerald-600 border-emerald-200",
	UPDATED: "bg-blue-50 text-blue-600 border-blue-200",
	STATUS_CHANGED: "bg-amber-50 text-amber-600 border-amber-200",
	COMMISSION_INSTALLMENT_UPDATED:
		"bg-indigo-50 text-indigo-600 border-indigo-200",
	COMMISSION_INSTALLMENT_STATUS_UPDATED:
		"bg-orange-50 text-orange-600 border-orange-200",
	COMMISSION_INSTALLMENT_DELETED: "bg-rose-50 text-rose-600 border-rose-200",
};

function getActorInitials(name: string | null) {
	if (!name) {
		return "US";
	}

	return name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part.slice(0, 1).toUpperCase())
		.join("");
}

function SaleDetailsPage() {
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const { saleId } = Route.useParams();
	const { organization } = useApp();
	const slug = organization?.slug ?? "";
	const navigate = useNavigate();
	const { data, isLoading, isError } = useSale(saleId);
	const productsQuery = useGetOrganizationsSlugProducts(
		{ slug },
		{
			query: {
				enabled: Boolean(organization?.slug),
			},
		},
	);
	const {
		data: historyData,
		isLoading: isHistoryLoading,
		isError: isHistoryError,
	} = useSaleHistory(saleId);
	const { mutateAsync: deleteSale, isPending: isDeletingSale } =
		useDeleteSale();
	const historyEvents = historyData?.history ?? [];
	const timelineEvents = historyEvents.map((event) =>
		toSaleHistoryTimelineEvent(event),
	);
	const productPathById = useMemo(
		() =>
			buildProductPathMap(
				(productsQuery.data?.products ?? []) as ProductTreeNode[],
			),
		[productsQuery.data?.products],
	);

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
	const saleProductPath =
		productPathById.get(sale.product.id) ?? sale.product.name;
	const dynamicFields = sale.dynamicFieldSchema.map((field) => ({
		...field,
		value: Object.prototype.hasOwnProperty.call(
			sale.dynamicFieldValues,
			field.fieldId,
		)
			? sale.dynamicFieldValues[field.fieldId]
			: null,
	}));

	return (
		<main className="w-full space-y-6">
			<header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div className="min-w-0 space-y-1">
					<h1 className="text-2xl font-semibold">Detalhes da Venda</h1>
					<span className="block text-muted-foreground text-sm break-all sm:break-normal">
						Código da venda: {sale.id}
					</span>
				</div>

				<div className="grid w-full gap-2 sm:grid-cols-4 md:flex md:w-auto md:items-center">
					<Button variant="outline" className="w-full md:w-auto" asChild>
						<Link to="/sales">
							<ArrowLeft className="size-4" />
							Voltar
						</Link>
					</Button>
					<Button variant="outline" className="w-full md:w-auto" asChild>
						<Link to="/sales/update/$saleId" params={{ saleId: sale.id }}>
							<Pencil className="size-4" />
							Editar
						</Link>
					</Button>
					<SaleStatusAction
						saleId={sale.id}
						currentStatus={sale.status as SaleStatus}
					/>
					<Button
						variant="destructive"
						className="w-full md:w-auto"
						onClick={() => setDeleteDialogOpen(true)}
						disabled={isDeletingSale}
					>
						<Trash2 className="size-4" />
						Excluir
					</Button>
				</div>
			</header>

			<Card className="p-6 space-y-4">
				<div className="">
					<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
						Produto
					</p>
					<p className="mt-1 text-lg font-semibold leading-snug md:text-xl">
						{saleProductPath}
					</p>
				</div>

				<div className="grid gap-4 md:grid-cols-3">
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
							{sale.responsibleType
								? SALE_RESPONSIBLE_TYPE_LABEL[sale.responsibleType]
								: "Não informado"}
						</p>
						<p>
							<strong>Nome:</strong> {sale.responsible?.name ?? "Não informado"}
						</p>
					</div>
				</Card>
			</div>

			<Card className="p-6 space-y-3">
				<h2 className="font-semibold">Campos personalizados</h2>

				{dynamicFields.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Esta venda não possui campos personalizados.
					</p>
				) : (
					<div className="space-y-2 text-sm">
						{dynamicFields.map((field) => (
							<p key={field.fieldId}>
								<strong>{field.label}:</strong>{" "}
								{formatSaleDynamicFieldValue(field, field.value)}
							</p>
						))}
					</div>
				)}
			</Card>

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
										}{" "}
										• {SALE_COMMISSION_DIRECTION_LABEL[commission.direction]}
									</p>
									<div className="text-right">
										<p className="font-semibold">
											{formatCommissionPercentage(commission.totalPercentage)}
										</p>
										<p className="text-muted-foreground text-xs">
											{formatCurrencyBRL(commission.totalAmount / 100)}
										</p>
									</div>
								</div>
								<p className="text-muted-foreground text-xs">
									Beneficiário:{" "}
									{commission.beneficiaryLabel ??
										commission.beneficiaryId ??
										"Não informado"}
								</p>
								<div className="space-y-1 text-muted-foreground text-xs">
									<p>Parcelas:</p>
									{commission.installments.map((installment) => (
										<p
											key={`${commission.id}-${installment.installmentNumber}`}
										>
											P{installment.installmentNumber} -{" "}
											{formatCommissionPercentage(installment.percentage)} -{" "}
											{formatCurrencyBRL(installment.amount / 100)}
										</p>
									))}
								</div>
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

			<Card className="p-6 space-y-4">
				<h2 className="font-semibold">Histórico de alterações</h2>

				{isHistoryLoading ? (
					<p className="text-sm text-muted-foreground">
						Carregando histórico...
					</p>
				) : isHistoryError ? (
					<p className="text-sm text-destructive">
						Não foi possível carregar o histórico.
					</p>
				) : historyEvents.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Nenhuma alteração registrada.
					</p>
				) : (
					<div className="relative space-y-5">
						<div className="absolute left-5 top-3 bottom-3 w-px bg-border" />
						{timelineEvents.map((event) => {
							const ActionIcon = SALE_HISTORY_ACTION_ICON[event.action];

							return (
								<article key={event.id} className="relative flex gap-3">
									<div
										className={`z-10 mt-1 flex size-10 shrink-0 items-center justify-center rounded-full border ${SALE_HISTORY_ACTION_ICON_CLASS[event.action]}`}
									>
										<ActionIcon className="size-5" />
									</div>

									<div className="w-full rounded-lg border bg-muted/20 p-4">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<p className="font-semibold">
												{SALE_HISTORY_ACTION_LABEL[event.action]}
											</p>
											<span className="text-muted-foreground text-xs">
												{formatDateTime(event.createdAt)}
											</span>
										</div>

										<div className="mt-2 flex items-center gap-2 text-muted-foreground text-xs">
											<Avatar className="size-5">
												<AvatarImage
													src={event.actor.avatarUrl ?? undefined}
													alt={event.actor.name ?? "Usuário"}
												/>
												<AvatarFallback className="text-[10px]">
													{getActorInitials(event.actor.name)}
												</AvatarFallback>
											</Avatar>
											<span>{event.actor.name ?? "Usuário sem nome"}</span>
										</div>

										<ul className="mt-3 space-y-1.5 text-sm">
											{event.messages.map((message, index) => (
												<li
													key={`${event.id}-${index}`}
													className="leading-relaxed"
												>
													{message}
												</li>
											))}
										</ul>
									</div>
								</article>
							);
						})}
					</div>
				)}
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
