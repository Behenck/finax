import { zodResolver } from "@hookform/resolvers/zod";
import { format, parse, parseISO } from "date-fns";
import { CalendarClock, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import { FieldError as FormFieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "@/components/ui/field";
import type { GetOrganizationsSlugSalesSaleid200 } from "@/http/generated";
import {
	useCreateSaleDelinquency,
	useDeleteSaleDelinquency,
	useResolveSaleDelinquency,
} from "@/hooks/sales";
import { SaleDelinquencyBadge } from "./sale-delinquency-badge";

const addSaleDelinquencySchema = z.object({
	dueDate: z
		.string()
		.min(1, "Informe a data de vencimento.")
		.refine((value) => value <= format(new Date(), "yyyy-MM-dd"), {
			message: "A data de vencimento não pode ser maior que hoje.",
		}),
});

type AddSaleDelinquencyFormData = z.infer<typeof addSaleDelinquencySchema>;
type SaleDelinquencyOccurrence =
	GetOrganizationsSlugSalesSaleid200["sale"]["openDelinquencies"][number];
type SaleDelinquencySummary =
	GetOrganizationsSlugSalesSaleid200["sale"]["delinquencySummary"];

interface SaleDelinquencySectionProps {
	saleId: string;
	customerId: string;
	saleStatus: GetOrganizationsSlugSalesSaleid200["sale"]["status"];
	summary: SaleDelinquencySummary;
	openDelinquencies: GetOrganizationsSlugSalesSaleid200["sale"]["openDelinquencies"];
	canManageDelinquencies: boolean;
}

function formatDate(value: string) {
	return format(parse(value.slice(0, 10), "yyyy-MM-dd", new Date()), "dd/MM/yyyy");
}

function formatDateTime(value: string) {
	return format(parseISO(value), "dd/MM/yyyy HH:mm");
}

function getUserLabel(user: { name: string | null } | null) {
	return user?.name ?? "Usuário sem nome";
}

function DelinquencyOccurrenceCard({
	occurrence,
	onResolve,
	onDelete,
	isResolving,
	isDeleting,
	canResolve,
	canDelete,
}: {
	occurrence: SaleDelinquencyOccurrence;
	onResolve?: (occurrence: SaleDelinquencyOccurrence) => void;
	onDelete?: (occurrence: SaleDelinquencyOccurrence) => void;
	isResolving?: boolean;
	isDeleting?: boolean;
	canResolve?: boolean;
	canDelete?: boolean;
}) {
	const canShowResolveAction = canResolve && onResolve;
	const canShowDeleteAction = canDelete && onDelete;

	return (
		<div
			className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4"
		>
			<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div className="space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<div
							className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-700 dark:text-rose-300"
						>
							<TriangleAlert className="size-3.5" />
							<span>Em aberto</span>
						</div>
						<span className="text-sm font-semibold">
							Vencimento em {formatDate(occurrence.dueDate)}
						</span>
					</div>

					<div className="space-y-1 text-sm text-muted-foreground">
						<p>Criada em {formatDateTime(occurrence.createdAt)}</p>
						<p>Criada por {getUserLabel(occurrence.createdBy)}</p>
						{occurrence.resolvedAt ? (
							<>
								<p>Resolvida em {formatDateTime(occurrence.resolvedAt)}</p>
								<p>Resolvida por {getUserLabel(occurrence.resolvedBy)}</p>
							</>
						) : null}
					</div>
				</div>

				{canShowResolveAction || canShowDeleteAction ? (
					<div className="flex flex-wrap items-center gap-2">
						{canShowResolveAction ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => onResolve(occurrence)}
								disabled={isResolving || isDeleting}
							>
								{isResolving ? "Resolvendo..." : "Resolver"}
							</Button>
						) : null}
						{canShowDeleteAction ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="border-rose-500/30 text-rose-700 hover:bg-rose-500/10 hover:text-rose-800 dark:text-rose-300 dark:hover:text-rose-200"
								onClick={() => onDelete(occurrence)}
								disabled={isDeleting || isResolving}
							>
								<Trash2 className="size-4" />
								{isDeleting ? "Excluindo..." : "Excluir"}
							</Button>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}

export function SaleDelinquencySection({
	saleId,
	customerId,
	saleStatus,
	summary,
	openDelinquencies,
	canManageDelinquencies,
}: SaleDelinquencySectionProps) {
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [delinquencyToResolve, setDelinquencyToResolve] =
		useState<SaleDelinquencyOccurrence | null>(null);
	const [delinquencyToDelete, setDelinquencyToDelete] =
		useState<SaleDelinquencyOccurrence | null>(null);
	const canAddDelinquency = canManageDelinquencies && saleStatus === "COMPLETED";
	const { mutateAsync: createSaleDelinquency, isPending: isCreatingDelinquency } =
		useCreateSaleDelinquency();
	const { mutateAsync: resolveSaleDelinquency, isPending: isResolvingDelinquency } =
		useResolveSaleDelinquency();
	const { mutateAsync: deleteSaleDelinquency, isPending: isDeletingDelinquency } =
		useDeleteSaleDelinquency();
	const today = new Date();
	const form = useForm<AddSaleDelinquencyFormData>({
		resolver: zodResolver(addSaleDelinquencySchema),
		defaultValues: {
			dueDate: "",
		},
	});

	async function handleSubmit(values: AddSaleDelinquencyFormData) {
		await createSaleDelinquency({
			saleId,
			dueDate: values.dueDate,
			customerId,
		});
		setIsAddDialogOpen(false);
		form.reset();
	}

	async function handleResolveDelinquency() {
		if (!delinquencyToResolve) {
			return;
		}

		await resolveSaleDelinquency({
			saleId,
			delinquencyId: delinquencyToResolve.id,
			customerId,
		});
		setDelinquencyToResolve(null);
	}

	async function handleDeleteDelinquency() {
		if (!delinquencyToDelete) {
			return;
		}

		await deleteSaleDelinquency({
			saleId,
			delinquencyId: delinquencyToDelete.id,
			customerId,
		});
		setDelinquencyToDelete(null);
	}

	return (
		<>
			<Card className="p-6 space-y-4">
				<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div className="space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<h2 className="font-semibold">Inadimplência</h2>
							<SaleDelinquencyBadge summary={summary} showOldestDueDate />
						</div>
						<p className="text-sm text-muted-foreground">
							A venda só aparece como inadimplente quando existe ao menos uma ocorrência em aberto.
						</p>
					</div>

					{canAddDelinquency ? (
						<Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(true)}>
							<Plus className="size-4" />
							Adicionar inadimplência
						</Button>
					) : null}
				</div>

				{!canAddDelinquency && canManageDelinquencies ? (
					<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
						Só é possível adicionar inadimplência em vendas concluídas.
					</div>
				) : null}

				<div className="space-y-3">
					<div className="flex items-center gap-2 text-sm font-medium">
						<CalendarClock className="size-4 text-muted-foreground" />
						<span>Ocorrências em aberto</span>
					</div>

					{openDelinquencies.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Nenhuma inadimplência em aberto nesta venda.
						</p>
					) : (
						<div className="space-y-3">
							{openDelinquencies.map((occurrence) => (
								<DelinquencyOccurrenceCard
									key={occurrence.id}
									occurrence={occurrence}
									canResolve={canManageDelinquencies}
									canDelete={canManageDelinquencies}
									onResolve={setDelinquencyToResolve}
									onDelete={setDelinquencyToDelete}
									isResolving={
										isResolvingDelinquency && delinquencyToResolve?.id === occurrence.id
									}
									isDeleting={
										isDeletingDelinquency && delinquencyToDelete?.id === occurrence.id
									}
								/>
							))}
						</div>
					)}
				</div>
			</Card>

			<Dialog
				open={isAddDialogOpen}
				onOpenChange={(open) => {
					setIsAddDialogOpen(open);
					if (!open) {
						form.reset();
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Adicionar inadimplência</DialogTitle>
						<DialogDescription>
							Informe a data de vencimento que não foi paga nesta venda.
						</DialogDescription>
					</DialogHeader>

					<form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
						<Controller
							control={form.control}
							name="dueDate"
							render={({ field, fieldState }) => (
								<Field>
									<FieldLabel>Data de vencimento</FieldLabel>
									<FieldContent>
										<CalendarDateInput
											value={field.value}
											onChange={field.onChange}
											aria-invalid={fieldState.invalid}
											disabled={isCreatingDelinquency}
											maxDate={today}
										/>
										<FieldDescription>
											Você pode registrar mais de uma inadimplência na mesma venda, desde que sejam vencimentos diferentes.
										</FieldDescription>
										<FormFieldError error={fieldState.error} />
									</FieldContent>
								</Field>
							)}
						/>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsAddDialogOpen(false)}
								disabled={isCreatingDelinquency}
							>
								Cancelar
							</Button>
							<Button type="submit" disabled={isCreatingDelinquency}>
								{isCreatingDelinquency ? "Salvando..." : "Adicionar inadimplência"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={Boolean(delinquencyToResolve)}
				onOpenChange={(open) => {
					if (!open) {
						setDelinquencyToResolve(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Resolver inadimplência</AlertDialogTitle>
						<AlertDialogDescription>
							{delinquencyToResolve
								? `Confirmar a resolução da inadimplência com vencimento em ${formatDate(delinquencyToResolve.dueDate)}? Ela sairá da lista ativa e ficará apenas no histórico.`
								: ""}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isResolvingDelinquency}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => void handleResolveDelinquency()}
							disabled={isResolvingDelinquency}
						>
							{isResolvingDelinquency ? "Resolvendo..." : "Resolver inadimplência"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={Boolean(delinquencyToDelete)}
				onOpenChange={(open) => {
					if (!open) {
						setDelinquencyToDelete(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir inadimplência</AlertDialogTitle>
						<AlertDialogDescription>
							{delinquencyToDelete
								? `Confirmar a exclusão da inadimplência com vencimento em ${formatDate(delinquencyToDelete.dueDate)}? Ela será removida da venda, e a ação de exclusão ficará registrada no histórico.`
								: ""}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeletingDelinquency}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => void handleDeleteDelinquency()}
							disabled={isDeletingDelinquency}
						>
							{isDeletingDelinquency ? "Excluindo..." : "Excluir inadimplência"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
