import { ArrowRight, Plus, Search, Trash2 } from "lucide-react";
import { useMemo } from "react";
import type {
	Control,
	UseFormGetValues,
	UseFormSetValue,
} from "react-hook-form";
import { useWatch } from "react-hook-form";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SaleFormData, SaleFormInput } from "@/schemas/sale-schema";
import type { SaleStatus } from "@/schemas/types/sales";
import { SaleCommissionCard } from "../../sale-commission-card";
import {
	buildSaleCommissionBaseOptionsByIndex,
	groupSaleCommissionsByBase,
	resolveEffectiveSaleCommissionsPercentages,
} from "../../sale-commission-helpers";
import { SaleInstallmentsPanel } from "../../sale-installments-panel";

type SelectOption = {
	id: string;
	label: string;
};

interface CommissionsSectionProps {
	isCommissionEditable: boolean;
	isCommissionAccessDenied: boolean;
	isInstallmentsSectionVisible: boolean;
	initialSaleId?: string;
	initialSaleStatus: SaleStatus;
	selectedProductId: string;
	hasSelectedProduct: boolean;
	hasRequestedCommissionForCurrentProduct: boolean;
	hasLoadedCommissionForCurrentProduct: boolean;
	isCommissionScenariosFetching: boolean;
	isCommissionScenariosError: boolean;
	matchedCommissionScenarioName?: string;
	commissionFields: Array<{ id: string }>;
	control: Control<SaleFormInput, unknown, SaleFormData>;
	setValue: UseFormSetValue<SaleFormInput>;
	getValues: UseFormGetValues<SaleFormInput>;
	onFetchCommissionScenarios(): void;
	onAddManualCommission(): void;
	onRemoveCommission(index: number): void;
	onRemovePulledCommissions(): void;
	onInstallmentCountChange(index: number, nextCount: number): void;
	pulledCommissionsCount: number;
	companyOptions: SelectOption[];
	unitOptions: SelectOption[];
	sellerOptions: SelectOption[];
	partnerOptions: SelectOption[];
	supervisorOptions: SelectOption[];
	saleTotalAmountInCents: number;
	commissionsError?: unknown;
}

export function CommissionsSection({
	isCommissionEditable,
	isCommissionAccessDenied,
	isInstallmentsSectionVisible,
	initialSaleId,
	initialSaleStatus,
	selectedProductId,
	hasSelectedProduct,
	hasRequestedCommissionForCurrentProduct,
	hasLoadedCommissionForCurrentProduct,
	isCommissionScenariosFetching,
	isCommissionScenariosError,
	matchedCommissionScenarioName,
	commissionFields,
	control,
	setValue,
	getValues,
	onFetchCommissionScenarios,
	onAddManualCommission,
	onRemoveCommission,
	onRemovePulledCommissions,
	onInstallmentCountChange,
	pulledCommissionsCount,
	companyOptions,
	unitOptions,
	sellerOptions,
	partnerOptions,
	supervisorOptions,
	saleTotalAmountInCents,
	commissionsError,
}: CommissionsSectionProps) {
	const commissionValues =
		(useWatch({
			control,
			name: "commissions",
		}) as SaleFormData["commissions"] | undefined) ?? [];

	const baseCommissionOptionsByIndex = useMemo(
		() => buildSaleCommissionBaseOptionsByIndex(commissionValues),
		[commissionValues],
	);
	const commissionGroups = useMemo(
		() => groupSaleCommissionsByBase(commissionValues),
		[commissionValues],
	);
	const effectivePercentagesByIndex = useMemo(
		() => resolveEffectiveSaleCommissionsPercentages(commissionValues),
		[commissionValues],
	);
	const hasLinkedCommissions = commissionFields.length > 0;

	if (isCommissionAccessDenied) {
		if (!hasLinkedCommissions) {
			return null;
		}

		return (
			<Card className="rounded-sm gap-4 p-5">
				<h2 className="font-semibold text-md">Comissões aplicáveis</h2>
				<p className="text-sm text-muted-foreground">
					Você não possui permissão para adicionar ou editar comissões nesta
					venda.
				</p>
			</Card>
		);
	}

	if (!isCommissionEditable) {
		return (
			<Card className="rounded-sm gap-4 p-5">
				<h2 className="font-semibold text-md">Parcelas de comissão</h2>
				<SaleInstallmentsPanel
					saleId={initialSaleId ?? ""}
					saleStatus={initialSaleStatus}
					enabled={isInstallmentsSectionVisible}
				/>
			</Card>
		);
	}

	return (
		<Card className="rounded-sm gap-4 p-5">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-2">
				<h2 className="font-semibold text-md">Comissões aplicáveis</h2>

				<div className="flex items-center gap-2 md:gap-1.5">
					<Button
						type="button"
						variant="outline"
						onClick={onAddManualCommission}
					>
						<Plus className="size-4" />
						Adicionar comissão
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={onFetchCommissionScenarios}
						disabled={!hasSelectedProduct || isCommissionScenariosFetching}
					>
						{isCommissionScenariosFetching ? (
							"Carregando..."
						) : hasLoadedCommissionForCurrentProduct ? (
							"Atualizar comissão"
						) : (
							<>
								<Search />
								Buscar comissão
							</>
						)}
					</Button>
					<Button
						type="button"
						size="icon"
						variant="outline"
						onClick={onRemovePulledCommissions}
						disabled={pulledCommissionsCount === 0}
					>
						<Trash2 className="size-4" />
					</Button>
				</div>
			</div>

			{!selectedProductId ? (
				<p className="text-sm text-muted-foreground">
					Selecione um produto para buscar comissão.
				</p>
			) : !hasRequestedCommissionForCurrentProduct ? (
				<p className="text-sm text-muted-foreground">
					Clique em buscar comissão para carregar as regras do produto.
				</p>
			) : isCommissionScenariosFetching ? (
				<p className="text-sm text-muted-foreground">
					Carregando cenários de comissão...
				</p>
			) : isCommissionScenariosError ? (
				<div className="space-y-3">
					<p className="text-sm text-destructive">
						Não foi possível carregar as comissões do produto.
					</p>
					<Button
						type="button"
						variant="outline"
						className="w-fit"
						onClick={onFetchCommissionScenarios}
					>
						Tentar novamente
					</Button>
				</div>
			) : !matchedCommissionScenarioName ? (
				<p className="text-sm text-muted-foreground">
					Nenhum cenário de comissão compatível com as condições atuais da
					venda.
				</p>
			) : (
				<div className="rounded-md border bg-muted/20 p-3">
					<p className="text-sm">
						<span className="text-muted-foreground">Cenário aplicado: </span>
						<strong>{matchedCommissionScenarioName}</strong>
					</p>
				</div>
			)}

			<div className="space-y-3 md:space-y-2">
				{commissionFields.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Nenhuma comissão adicionada.
					</p>
				) : (
					commissionGroups.map((group) => {
						const parentCommissionField = commissionFields[group.parentIndex];
						if (!parentCommissionField) {
							return null;
						}

						return (
							<div
								key={parentCommissionField.id}
								className="space-y-3 md:space-y-2"
							>
								<SaleCommissionCard
									index={group.parentIndex}
									control={control}
									setValue={setValue}
									getValues={getValues}
									onRemove={onRemoveCommission}
									onInstallmentCountChange={onInstallmentCountChange}
									companyOptions={companyOptions}
									unitOptions={unitOptions}
									sellerOptions={sellerOptions}
									partnerOptions={partnerOptions}
									supervisorOptions={supervisorOptions}
									saleTotalAmountInCents={saleTotalAmountInCents}
									baseCommissionOptions={
										baseCommissionOptionsByIndex[group.parentIndex] ?? []
									}
									effectiveTotalPercentage={
										effectivePercentagesByIndex[group.parentIndex]
											?.totalPercentage
									}
									effectiveInstallmentPercentages={
										effectivePercentagesByIndex[group.parentIndex]
											?.installmentPercentages
									}
								/>

								{group.childIndexes.map((childIndex) => {
									const childCommissionField = commissionFields[childIndex];
									if (!childCommissionField) {
										return null;
									}

									return (
										<div
											key={childCommissionField.id}
											className="ml-4 space-y-2 border-l border-dashed border-muted-foreground/40 pl-4 md:ml-3 md:space-y-1.5 md:pl-3"
										>
											<div className="flex items-center gap-2 text-muted-foreground text-xs">
												<ArrowRight className="size-3.5" />
												Vinculada à comissão {group.parentIndex + 1}
											</div>

											<SaleCommissionCard
												index={childIndex}
												control={control}
												setValue={setValue}
												getValues={getValues}
												onRemove={onRemoveCommission}
												onInstallmentCountChange={onInstallmentCountChange}
												companyOptions={companyOptions}
												unitOptions={unitOptions}
												sellerOptions={sellerOptions}
												partnerOptions={partnerOptions}
												supervisorOptions={supervisorOptions}
												saleTotalAmountInCents={saleTotalAmountInCents}
												baseCommissionOptions={
													baseCommissionOptionsByIndex[childIndex] ?? []
												}
												effectiveTotalPercentage={
													effectivePercentagesByIndex[childIndex]
														?.totalPercentage
												}
												effectiveInstallmentPercentages={
													effectivePercentagesByIndex[childIndex]
														?.installmentPercentages
												}
											/>
										</div>
									);
								})}
							</div>
						);
					})
				)}
			</div>

			<FieldError error={commissionsError} />
		</Card>
	);
}
