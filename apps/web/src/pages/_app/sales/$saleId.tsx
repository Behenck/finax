import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format, parse, parseISO } from "date-fns";
import {
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	Eye,
	FilePenLine,
	type LucideIcon,
	PlusCircle,
	TriangleAlert,
	Trash2,
	WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";
import { LoadingReveal } from "@/components/loading-reveal";
import {
	DetailPageSkeleton,
	TimelineSectionSkeleton,
} from "@/components/loading-skeletons";
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useApp } from "@/context/app-context";
import {
	useDeleteSale,
	useSale,
	useSaleHistory,
	useSaleNavigation,
} from "@/hooks/sales";
import { useGetOrganizationsSlugProducts } from "@/http/generated";
import { useAbility } from "@/permissions/access";
import {
	SALE_COMMISSION_DIRECTION_LABEL,
	SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
	SALE_COMMISSION_SOURCE_TYPE_LABEL,
	SALE_RESPONSIBLE_TYPE_LABEL,
	type SaleStatus,
} from "@/schemas/types/sales";
import { formatCurrencyBRL } from "@/utils/format-amount";
import { SaleActionsDropdown } from "./-components/sale-actions-dropdown";
import { formatSaleDynamicFieldValue } from "./-components/sale-dynamic-fields";
import {
	SALE_HISTORY_ACTION_LABEL,
	type SaleHistoryEvent,
	toSaleHistoryTimelineEvent,
} from "./-components/sale-history-presenter";
import { SaleDelinquencySection } from "./-components/sale-delinquency-section";
import { SaleInstallmentsDrawer } from "./-components/sale-installments-drawer";
import { SalePreCancellationBadge } from "./-components/sale-pre-cancellation-badge";
import { SaleStatusAction } from "./-components/sale-status-action";
import { SaleStatusBadge } from "./-components/sale-status-badge";

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
		DELINQUENCY_CREATED: TriangleAlert,
		DELINQUENCY_RESOLVED: CheckCircle2,
		DELINQUENCY_DELETED: Trash2,
		COMMISSION_INSTALLMENT_UPDATED: WalletCards,
		COMMISSION_INSTALLMENT_STATUS_UPDATED: CheckCircle2,
		COMMISSION_INSTALLMENT_DELETED: Trash2,
	};

const SALE_HISTORY_ACTION_ICON_CLASS: Record<
	SaleHistoryEvent["action"],
	string
> = {
	CREATED:
		"bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
	UPDATED: "bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30",
	STATUS_CHANGED: "bg-amber-500/10 text-amber-600 border-amber-500/30",
	DELINQUENCY_CREATED:
		"bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30",
	DELINQUENCY_RESOLVED:
		"bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
	DELINQUENCY_DELETED:
		"bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30",
	COMMISSION_INSTALLMENT_UPDATED:
		"bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
	COMMISSION_INSTALLMENT_STATUS_UPDATED:
		"bg-orange-500/10 text-orange-600 border-orange-500/30",
	COMMISSION_INSTALLMENT_DELETED:
		"bg-rose-500/10 text-rose-600 border-rose-500/30",
};

type SaleInstallmentsDrawerState =
	| {
			mode: "ALL";
	  }
	| {
			mode: "COMMISSION";
			saleCommissionId: string;
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

export function SaleDetailsPage() {
	const ability = useAbility();
	const canViewSale = ability.can("access", "sales.view");
	const canUpdateSale = ability.can("access", "sales.update");
	const canCreateSale = ability.can("access", "sales.create");
	const canChangeSaleStatus = ability.can("access", "sales.status.change");
	const canDeleteSalePermission = ability.can("access", "sales.delete");
	const canManageCommissions = ability.can(
		"access",
		"sales.commissions.manage",
	);
	const canChangeCommissionInstallmentStatus = ability.can(
		"access",
		"sales.commissions.installments.status.change",
	);
	const canUpdateCommissionInstallment = ability.can(
		"access",
		"sales.commissions.installments.update",
	);
	const canDeleteCommissionInstallment = ability.can(
		"access",
		"sales.commissions.installments.delete",
	);
	const canAccessCommissionInstallments =
		canManageCommissions ||
		canChangeCommissionInstallmentStatus ||
		canUpdateCommissionInstallment ||
		canDeleteCommissionInstallment;
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [expandedHistoryEventIds, setExpandedHistoryEventIds] = useState<
		Set<string>
	>(() => new Set());
	const [installmentsDrawerState, setInstallmentsDrawerState] =
		useState<SaleInstallmentsDrawerState | null>(null);
	const { saleId } = Route.useParams();
	const {
		previousSaleId,
		nextSaleId,
		isLoading: isSaleNavigationLoading,
	} = useSaleNavigation(saleId);
	const { organization } = useApp();
	const preCancellationDelinquencyThreshold =
		organization?.preCancellationDelinquencyThreshold ?? null;
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

	if (!canViewSale) {
		return (
			<Card className="p-6">
				<span className="text-muted-foreground">
					Você não possui permissão para visualizar esta venda.
				</span>
			</Card>
		);
	}

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

	function toggleHistoryEventDetails(eventId: string) {
		setExpandedHistoryEventIds((currentIds) => {
			const nextIds = new Set(currentIds);

			if (nextIds.has(eventId)) {
				nextIds.delete(eventId);
			} else {
				nextIds.add(eventId);
			}

			return nextIds;
		});
	}

	function handleGoToPreviousSale() {
		if (!previousSaleId) {
			return;
		}

		void navigate({
			to: "/sales/$saleId",
			params: {
				saleId: previousSaleId,
			},
		});
	}

	function handleGoToNextSale() {
		if (!nextSaleId) {
			return;
		}

		void navigate({
			to: "/sales/$saleId",
			params: {
				saleId: nextSaleId,
			},
		});
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
	const canEditSale =
		canUpdateSale || (canCreateSale && sale.status === "PENDING");
	const isSaleCompleted = sale.status === "COMPLETED";
	const saleProductPath =
		productPathById.get(sale.product.id) ?? sale.product.name;
	const dynamicFields = sale.dynamicFieldSchema.map((field) => ({
		...field,
		value: Object.hasOwn(sale.dynamicFieldValues, field.fieldId)
			? sale.dynamicFieldValues[field.fieldId]
			: null,
	}));

	return (
		<LoadingReveal
			loading={isLoading}
			skeleton={
				<DetailPageSkeleton actionCount={4} summaryCount={4} detailCount={4} />
			}
			contentKey={saleId}
		>
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
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="w-full md:w-10"
									aria-label="Venda anterior"
									disabled={isSaleNavigationLoading || !previousSaleId}
									onClick={handleGoToPreviousSale}
								>
									<ArrowLeft className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="top">Ir para venda anterior</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="w-full md:w-10"
									aria-label="Venda próxima"
									disabled={isSaleNavigationLoading || !nextSaleId}
									onClick={handleGoToNextSale}
								>
									<ArrowRight className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="top">Ir para próxima venda</TooltipContent>
						</Tooltip>
						<SaleActionsDropdown
							saleId={sale.id}
							customerId={sale.customer.id}
							canCreateSale={canCreateSale}
							canEditSale={canEditSale}
							canDeleteSale={canDeleteSalePermission}
							isDeleting={isDeletingSale}
							onRequestDelete={() => setDeleteDialogOpen(true)}
						/>
						{canChangeSaleStatus ? (
							<SaleStatusAction
								saleId={sale.id}
								currentStatus={sale.status as SaleStatus}
								buttonMode="modal-only"
							/>
						) : null}
					</div>
				</header>

				<Card className="p-6 space-y-3">
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
							<p
								className={
									sale.totalAmount === 0
										? "font-semibold text-muted-foreground"
										: "font-semibold"
								}
							>
								{formatCurrencyBRL(sale.totalAmount / 100)}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Status</p>
							<div className="flex flex-wrap items-center gap-2">
								<SaleStatusBadge status={sale.status} />
								<SalePreCancellationBadge
									threshold={preCancellationDelinquencyThreshold}
									summary={sale.delinquencySummary}
								/>
							</div>
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
								<strong>Nome:</strong>{" "}
								{sale.responsible?.name ?? "Não informado"}
							</p>
						</div>
					</Card>
				</div>

				{isSaleCompleted ? (
					<SaleDelinquencySection
						saleId={sale.id}
						customerId={sale.customer.id}
						saleStatus={sale.status}
						summary={sale.delinquencySummary}
						openDelinquencies={sale.openDelinquencies}
						canManageDelinquencies={canUpdateSale}
					/>
				) : null}

				<Card className="p-6 space-y-3">
					<h2 className="font-semibold">Campos personalizados</h2>

					{dynamicFields.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Esta venda não possui campos personalizados.
						</p>
					) : (
						<div className="grid gap-2 text-sm md:grid-cols-2">
							{dynamicFields.map((field) => (
								<p
									key={field.fieldId}
									className={
										field.type === "RICH_TEXT" ? "md:col-span-2" : undefined
									}
								>
									<strong>{field.label}:</strong>{" "}
									{formatSaleDynamicFieldValue(field, field.value)}
								</p>
							))}
						</div>
					)}
				</Card>

				<Card className="p-6 space-y-3">
					<div className="flex items-center justify-between gap-2">
						<h2 className="font-semibold">Comissões da venda</h2>
						{canAccessCommissionInstallments && sale.commissions.length > 0 ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setInstallmentsDrawerState({ mode: "ALL" })}
							>
								<Eye className="size-4" />
								Ver todas
							</Button>
						) : null}
					</div>

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
											{SALE_COMMISSION_SOURCE_TYPE_LABEL[commission.sourceType]}{" "}
											•{" "}
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
											{canAccessCommissionInstallments ? (
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="mt-2"
													onClick={() =>
														setInstallmentsDrawerState({
															mode: "COMMISSION",
															saleCommissionId: commission.id,
														})
													}
												>
													<Eye className="size-4" />
													Ver
												</Button>
											) : null}
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
					<h2 className="font-semibold">Observação</h2>
					<p className="text-sm text-muted-foreground">
						{sale.notes ?? "Sem observações."}
					</p>
				</Card>

				<Card className="p-6 space-y-4">
					<h2 className="font-semibold">Histórico de alterações</h2>

					{isHistoryLoading ? (
						<TimelineSectionSkeleton itemCount={3} />
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
								const isDetailsExpanded = expandedHistoryEventIds.has(event.id);

								return (
									<article key={event.id} className="relative flex gap-3">
										<div className="z-10 mt-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-background">
											<div
												className={`flex size-10 items-center justify-center rounded-full border ${SALE_HISTORY_ACTION_ICON_CLASS[event.action]}`}
											>
												<ActionIcon className="size-5" />
											</div>
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

											{event.isCompact ? (
												<div className="mt-3 space-y-3">
													<Button
														type="button"
														variant="link"
														size="sm"
														className="h-auto p-0 text-xs"
														onClick={() => toggleHistoryEventDetails(event.id)}
													>
														{isDetailsExpanded
															? "Ocultar detalhes"
															: `Ver detalhes (${event.detailsCount})`}
													</Button>

													{isDetailsExpanded ? (
														<ul className="space-y-1.5 border-l pl-3 text-muted-foreground text-sm">
															{event.detailMessages.map((message, index) => (
																<li
																	key={`${event.id}-detail-${index}`}
																	className="leading-relaxed"
																>
																	{message}
																</li>
															))}
														</ul>
													) : null}
												</div>
											) : null}
										</div>
									</article>
								);
							})}
						</div>
					)}
				</Card>

				{installmentsDrawerState ? (
					<SaleInstallmentsDrawer
						open={Boolean(installmentsDrawerState)}
						onOpenChange={(open) => {
							if (!open) {
								setInstallmentsDrawerState(null);
							}
						}}
						saleId={sale.id}
						saleStatus={sale.status as SaleStatus}
						saleProductId={sale.product.id}
						saleCommissionId={
							installmentsDrawerState.mode === "COMMISSION"
								? installmentsDrawerState.saleCommissionId
								: undefined
						}
					/>
				) : null}

				<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Excluir venda</AlertDialogTitle>
							<AlertDialogDescription>
								Tem certeza que deseja excluir esta venda? Esta ação não pode
								ser desfeita.
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
		</LoadingReveal>
	);
}
