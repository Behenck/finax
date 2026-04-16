import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	useGetOrganizationsSlugProducts,
	usePostOrganizationsSlugCommissionsBonusSettlements,
} from "@/http/generated";

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

interface BonusSettlementDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function BonusSettlementDialog({
	open,
	onOpenChange,
}: BonusSettlementDialogProps) {
	const { organization } = useApp();
	const queryClient = useQueryClient();
	const [productId, setProductId] = useState("");
	const [periodFrequency, setPeriodFrequency] =
		useState<BonusSettlementFrequency>("MONTHLY");
	const [periodYear, setPeriodYear] = useState(() => new Date().getFullYear());
	const [periodIndex, setPeriodIndex] = useState(1);
	const [settledAt, setSettledAt] = useState(() => format(new Date(), "yyyy-MM-dd"));

	const { data: productsData, isLoading: isLoadingProducts } =
		useGetOrganizationsSlugProducts(
			{ slug: organization?.slug ?? "" },
			{
				query: {
					enabled: Boolean(organization?.slug) && open,
				},
			},
		);
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
	const canSubmit =
		Boolean(productId) &&
		periodYear >= 2000 &&
		periodYear <= 9999 &&
		isClosedCycle &&
		!isSettlingBonus;

	function resetFormState() {
		setProductId("");
		setPeriodFrequency("MONTHLY");
		setPeriodYear(new Date().getFullYear());
		setPeriodIndex(1);
		setSettledAt(format(new Date(), "yyyy-MM-dd"));
	}

	function handleOpenChange(nextOpen: boolean) {
		onOpenChange(nextOpen);
		if (!nextOpen) {
			resetFormState();
		}
	}

	function handleFrequencyChange(nextFrequency: BonusSettlementFrequency) {
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

	async function handleConfirmSettlement() {
		if (!organization?.slug) {
			toast.error("Organização não encontrada.");
			return;
		}
		if (!canSubmit) {
			toast.error("Preencha os campos e selecione um ciclo fechado.");
			return;
		}

		try {
			const response = await settleBonus({
				slug: organization.slug,
				data: {
					productId,
					periodFrequency,
					periodYear,
					periodIndex,
					settledAt: settledAt || undefined,
				},
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
			handleOpenChange(false);
		} catch (error) {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Trophy className="size-4" />
						Apurar bônus
					</DialogTitle>
					<DialogDescription>
						Selecione produto e ciclo fechado para apurar as metas locais.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					<Field className="gap-1">
						<FieldLabel>Produto</FieldLabel>
						<Select value={productId} onValueChange={setProductId}>
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

					<div className="grid gap-3 md:grid-cols-3">
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
								onChange={(event) =>
									setPeriodYear(
										Number.parseInt(event.target.value || "0", 10) || 0,
									)
								}
							/>
						</Field>

						<Field className="gap-1">
							<FieldLabel>Ciclo</FieldLabel>
							<Select
								value={String(periodIndex)}
								onValueChange={(value) => setPeriodIndex(Number(value))}
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
					</div>

					<Field className="gap-1">
						<FieldLabel>Data da apuração</FieldLabel>
						<CalendarDateInput value={settledAt} onChange={setSettledAt} />
					</Field>

					{isClosedCycle ? (
						<p className="text-xs text-muted-foreground">
							Ciclo fechado validado. A apuração pode ser executada.
						</p>
					) : (
						<p className="text-xs text-destructive">
							Selecione um ciclo fechado (o ciclo atual ainda não pode ser apurado).
						</p>
					)}
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={isSettlingBonus}
					>
						Cancelar
					</Button>
					<Button
						type="button"
						onClick={() => {
							void handleConfirmSettlement();
						}}
						disabled={!canSubmit}
					>
						{isSettlingBonus ? "Apurando..." : "Apurar bônus"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
