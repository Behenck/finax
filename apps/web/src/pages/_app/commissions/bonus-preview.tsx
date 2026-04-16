import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, Eye, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	useGetOrganizationsSlugProducts,
	usePostOrganizationsSlugCommissionsBonusSettlements,
	usePostOrganizationsSlugCommissionsBonusSettlementsPreview,
	type PostOrganizationsSlugCommissionsBonusSettlementsPreview200,
} from "@/http/generated";
import { formatCurrencyBRL } from "@/utils/format-amount";

type BonusSettlementFrequency = "MONTHLY" | "SEMIANNUAL" | "ANNUAL";

type ProductNode = {
	id: string;
	name: string;
	children?: ProductNode[];
};

type ProductOption = {
	id: string;
	label: string;
};

const FREQUENCY_LABEL: Record<BonusSettlementFrequency, string> = {
	MONTHLY: "Mensal",
	SEMIANNUAL: "Semestral",
	ANNUAL: "Anual",
};

const PARTICIPANT_TYPE_LABEL: Record<string, string> = {
	COMPANY: "Empresa",
	PARTNER: "Parceiro",
	SELLER: "Vendedor",
	SUPERVISOR: "Supervisor",
};

const MONTH_LABEL: Record<number, string> = {
	1: "Jan",
	2: "Fev",
	3: "Mar",
	4: "Abr",
	5: "Mai",
	6: "Jun",
	7: "Jul",
	8: "Ago",
	9: "Set",
	10: "Out",
	11: "Nov",
	12: "Dez",
};

export const Route = createFileRoute("/_app/commissions/bonus-preview")({
	component: BonusPreviewPage,
});

function flattenProductOptions(
	nodes: ProductNode[],
	parentPath: string[] = [],
	options: ProductOption[] = [],
) {
	for (const node of nodes) {
		const currentPath = [...parentPath, node.name];
		options.push({
			id: node.id,
			label: currentPath.join(" -> "),
		});

		const children = Array.isArray(node.children) ? node.children : [];
		flattenProductOptions(children, currentPath, options);
	}

	return options;
}

function getPeriodOptions(frequency: BonusSettlementFrequency) {
	if (frequency === "MONTHLY") {
		return Array.from({ length: 12 }, (_, monthIndex) => ({
			value: monthIndex + 1,
			label: `${MONTH_LABEL[monthIndex + 1]}/${String(monthIndex + 1).padStart(2, "0")}`,
		}));
	}

	if (frequency === "SEMIANNUAL") {
		return [
			{ value: 1, label: "1º semestre" },
			{ value: 2, label: "2º semestre" },
		];
	}

	return [{ value: 1, label: "Ano inteiro" }];
}

function resolveClosedCycle(params: {
	frequency: BonusSettlementFrequency;
	periodYear: number;
	periodIndex: number;
}) {
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;

	if (params.frequency === "ANNUAL") {
		return params.periodYear < currentYear;
	}

	if (params.frequency === "SEMIANNUAL") {
		const currentSemester = currentMonth <= 6 ? 1 : 2;
		return (
			params.periodYear < currentYear ||
			(params.periodYear === currentYear &&
				params.periodIndex < currentSemester)
		);
	}

	return (
		params.periodYear < currentYear ||
		(params.periodYear === currentYear && params.periodIndex < currentMonth)
	);
}

function formatDate(value?: string) {
	if (!value) {
		return "-";
	}

	return format(new Date(value), "dd/MM/yyyy");
}

function formatPercentage(value: number) {
	return `${new Intl.NumberFormat("pt-BR", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 4,
	}).format(value)}%`;
}

function BonusPreviewPage() {
	const { organization } = useApp();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [productId, setProductId] = useState("");
	const [periodFrequency, setPeriodFrequency] =
		useState<BonusSettlementFrequency>("MONTHLY");
	const [periodYear, setPeriodYear] = useState(() => new Date().getFullYear());
	const [periodIndex, setPeriodIndex] = useState(1);
	const [settledAt, setSettledAt] = useState(() => format(new Date(), "yyyy-MM-dd"));
	const [preview, setPreview] =
		useState<PostOrganizationsSlugCommissionsBonusSettlementsPreview200 | null>(
			null,
		);

	const { data: productsData, isLoading: isLoadingProducts } =
		useGetOrganizationsSlugProducts(
			{ slug: organization?.slug ?? "" },
			{
				query: {
					enabled: Boolean(organization?.slug),
				},
			},
		);
	const { mutateAsync: previewBonus, isPending: isPreviewingBonus } =
		usePostOrganizationsSlugCommissionsBonusSettlementsPreview();
	const { mutateAsync: settleBonus, isPending: isSettlingBonus } =
		usePostOrganizationsSlugCommissionsBonusSettlements();

	const productOptions = useMemo(
		() => flattenProductOptions((productsData?.products ?? []) as ProductNode[]),
		[productsData?.products],
	);
	const periodOptions = useMemo(
		() => getPeriodOptions(periodFrequency),
		[periodFrequency],
	);
	const isClosedCycle = useMemo(
		() =>
			resolveClosedCycle({
				frequency: periodFrequency,
				periodYear,
				periodIndex,
			}),
		[periodFrequency, periodIndex, periodYear],
	);
	const canPreview =
		Boolean(productId) &&
		periodYear >= 2000 &&
		periodYear <= 9999 &&
		isClosedCycle &&
		!isPreviewingBonus;
	const canConfirm =
		Boolean(preview) &&
		!preview?.isSettled &&
		!isSettlingBonus &&
		!isPreviewingBonus;

	function resetPreview() {
		setPreview(null);
	}

	function handleFrequencyChange(nextFrequency: BonusSettlementFrequency) {
		resetPreview();
		setPeriodFrequency(nextFrequency);
		if (nextFrequency === "ANNUAL") {
			setPeriodIndex(1);
			return;
		}
		if (nextFrequency === "SEMIANNUAL") {
			setPeriodIndex((currentValue) => (currentValue > 2 ? 2 : currentValue));
			return;
		}
		setPeriodIndex((currentValue) =>
			currentValue > 12 ? 12 : currentValue < 1 ? 1 : currentValue,
		);
	}

	function buildPayload() {
		return {
			productId,
			periodFrequency,
			periodYear,
			periodIndex,
			settledAt: settledAt || undefined,
		};
	}

	async function handlePreview() {
		if (!organization?.slug) {
			toast.error("Organização não encontrada.");
			return;
		}
		if (!canPreview) {
			toast.error("Preencha os campos e selecione um ciclo fechado.");
			return;
		}

		try {
			const response = await previewBonus({
				slug: organization.slug,
				data: buildPayload(),
			});
			setPreview(response);
			if (response.isSettled) {
				toast.info("Este ciclo já foi apurado. A prévia foi aberta em modo leitura.");
				return;
			}
			toast.success("Prévia calculada com sucesso.");
		} catch (error) {
			setPreview(null);
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		}
	}

	async function handleConfirmSettlement() {
		if (!organization?.slug || !preview) {
			return;
		}

		try {
			const response = await settleBonus({
				slug: organization.slug,
				data: buildPayload(),
			});

			await queryClient.invalidateQueries({
				queryKey: [
					{
						url: "/organizations/:slug/commissions/installments",
						params: {
							slug: organization.slug,
						},
					},
				],
			});

			toast.success(
				`Apuração concluída: ${response.winnersCount} ganhador(es) e ${response.installmentsCount} parcela(s) gerada(s).`,
			);
			await navigate({ to: "/commissions" });
		} catch (error) {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		}
	}

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Prévia de bônus"
				description="Veja quem vai ganhar bônus no ciclo selecionado antes de confirmar a apuração."
				actions={
					<Button asChild variant="outline" className="w-full sm:w-auto">
						<Link to="/commissions">
							<ArrowLeft className="size-4" />
							Voltar
						</Link>
					</Button>
				}
			/>

			<Card className="space-y-4 p-4">
				<div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(140px,1fr))]">
					<Field className="gap-1">
						<FieldLabel>Produto</FieldLabel>
						<Select
							value={productId}
							onValueChange={(value) => {
								resetPreview();
								setProductId(value);
							}}
						>
							<SelectTrigger>
								<SelectValue
									placeholder={
										isLoadingProducts
											? "Carregando produtos..."
											: "Selecione um produto"
									}
								/>
							</SelectTrigger>
							<SelectContent>
								{productOptions.map((option) => (
									<SelectItem key={option.id} value={option.id}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					<Field className="gap-1">
						<FieldLabel>Frequência</FieldLabel>
						<Select
							value={periodFrequency}
							onValueChange={(value) =>
								handleFrequencyChange(value as BonusSettlementFrequency)
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{(Object.keys(FREQUENCY_LABEL) as BonusSettlementFrequency[]).map(
									(frequencyKey) => (
										<SelectItem key={frequencyKey} value={frequencyKey}>
											{FREQUENCY_LABEL[frequencyKey]}
										</SelectItem>
									),
								)}
							</SelectContent>
						</Select>
					</Field>

					<Field className="gap-1">
						<FieldLabel>Ano</FieldLabel>
						<Input
							type="number"
							min={2000}
							max={9999}
							step={1}
							value={periodYear}
							onChange={(event) => {
								resetPreview();
								setPeriodYear(
									Number.parseInt(event.target.value || "0", 10) || 0,
								);
							}}
						/>
					</Field>

					<Field className="gap-1">
						<FieldLabel>Ciclo</FieldLabel>
						<Select
							value={String(periodIndex)}
							onValueChange={(value) => {
								resetPreview();
								setPeriodIndex(Number(value));
							}}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{periodOptions.map((option) => (
									<SelectItem key={option.value} value={String(option.value)}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					<Field className="gap-1">
						<FieldLabel>Data da apuração</FieldLabel>
						<CalendarDateInput
							value={settledAt}
							onChange={(value) => {
								resetPreview();
								setSettledAt(value);
							}}
						/>
					</Field>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					{isClosedCycle ? (
						<p className="text-xs text-muted-foreground">
							Ciclo fechado validado. Visualize os ganhadores para confirmar a apuração.
						</p>
					) : (
						<p className="text-xs text-destructive">
							Selecione um ciclo fechado (o ciclo atual ainda não pode ser apurado).
						</p>
					)}

					<div className="flex flex-col gap-2 sm:flex-row">
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								void handlePreview();
							}}
							disabled={!canPreview}
						>
							<Eye className="size-4" />
							{isPreviewingBonus ? "Calculando..." : "Visualizar ganhadores"}
						</Button>
						<Button
							type="button"
							onClick={() => {
								void handleConfirmSettlement();
							}}
							disabled={!canConfirm}
						>
							<Trophy className="size-4" />
							{preview?.isSettled
								? "Ciclo já apurado"
								: isSettlingBonus
									? "Apurando..."
									: "Confirmar apuração"}
						</Button>
					</div>
				</div>
			</Card>

			{preview ? (
				<>
					{preview.isSettled ? (
						<Card className="border-amber-200 bg-amber-50 p-4 text-amber-900">
							<p className="font-medium">Este ciclo já foi apurado.</p>
							<p className="mt-1 text-sm">
								A visualização está em modo leitura para evitar bônus duplicado.
								Escolha outro ciclo se quiser fazer uma nova apuração.
							</p>
						</Card>
					) : null}

					<div className="grid gap-3 md:grid-cols-4">
						<Card className="p-4">
							<p className="text-sm text-muted-foreground">Ganhadores</p>
							<p className="text-2xl font-semibold">{preview.winnersCount}</p>
						</Card>
						<Card className="p-4">
							<p className="text-sm text-muted-foreground">Vendido no ciclo</p>
							<p className="text-2xl font-semibold">
								{formatCurrencyBRL(preview.salesTotalAmount / 100)}
							</p>
						</Card>
						<Card className="p-4">
							<p className="text-sm text-muted-foreground">Metas avaliadas</p>
							<p className="text-2xl font-semibold">{preview.scenariosCount}</p>
						</Card>
						<Card className="p-4">
							<p className="text-sm text-muted-foreground">Parcelas geradas</p>
							<p className="text-2xl font-semibold">
								{preview.installmentsCount}
							</p>
						</Card>
					</div>

					<Card className="p-4">
						<div className="mb-4 flex flex-col gap-1">
							<p className="font-medium">Ganhadores previstos</p>
							<p className="text-sm text-muted-foreground">
								{preview.product.name} · {formatDate(preview.periodStart)} até{" "}
								{formatDate(preview.periodEnd)} · {preview.salesCount} venda(s)
								considerada(s)
							</p>
						</div>

						{preview.winners.length === 0 ? (
							<div className="rounded-md border border-dashed p-6 text-center">
								<p className="font-medium">
									{preview.isSettled
										? "Este ciclo foi apurado sem ganhadores."
										: "Nenhum ganhador neste ciclo."}
								</p>
								<p className="mt-1 text-sm text-muted-foreground">
									{preview.isSettled
										? "Nenhuma parcela de bônus foi gerada nessa apuração."
										: "Se confirmar, a apuração será registrada com zero ganhadores."}
								</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Meta</TableHead>
										<TableHead>Beneficiário</TableHead>
										<TableHead>Tipo</TableHead>
										<TableHead className="text-right">Realizado</TableHead>
										<TableHead className="text-right">Meta</TableHead>
										<TableHead className="text-right">Bônus</TableHead>
										<TableHead>Parcelas</TableHead>
										<TableHead>1º vencimento</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{preview.winners.map((winner) => {
										const firstInstallment = winner.payoutInstallments[0];

										return (
											<TableRow
												key={`${winner.scenarioId}-${winner.participantType}-${winner.beneficiaryLabel}`}
											>
												<TableCell>{winner.scenarioName}</TableCell>
												<TableCell>{winner.beneficiaryLabel}</TableCell>
												<TableCell>
													{PARTICIPANT_TYPE_LABEL[winner.participantType] ??
														winner.participantType}
												</TableCell>
												<TableCell className="text-right">
													{formatCurrencyBRL(winner.achievedAmount / 100)}
												</TableCell>
												<TableCell className="text-right">
													{formatCurrencyBRL(winner.targetAmount / 100)}
												</TableCell>
												<TableCell className="text-right">
													{winner.payoutEnabled
														? `${formatCurrencyBRL(winner.payoutAmount / 100)} (${formatPercentage(winner.payoutTotalPercentage)})`
														: "Sem bonificação"}
												</TableCell>
												<TableCell>
													{winner.payoutInstallments.length > 0
														? `${winner.payoutInstallments.length} parcela(s)`
														: "-"}
												</TableCell>
												<TableCell>
													{formatDate(firstInstallment?.expectedPaymentDate)}
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						)}
					</Card>
				</>
			) : (
				<Card className="p-6 text-center">
					<p className="font-medium">Nenhuma prévia calculada ainda.</p>
					<p className="mt-1 text-sm text-muted-foreground">
						Selecione produto e ciclo fechado, depois clique em “Visualizar ganhadores”.
					</p>
				</Card>
			)}
		</main>
	);
}
