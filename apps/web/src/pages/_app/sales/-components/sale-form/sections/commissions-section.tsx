import { Plus, Trash2 } from "lucide-react";
import type {
	Control,
	UseFormGetValues,
	UseFormSetValue,
} from "react-hook-form";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SaleCommissionCard } from "../../sale-commission-card";
import { SaleInstallmentsPanel } from "../../sale-installments-panel";
import type { SaleFormData, SaleFormInput } from "@/schemas/sale-schema";
import type { SaleStatus } from "@/schemas/types/sales";

type SelectOption = {
	id: string;
	label: string;
};

interface CommissionsSectionProps {
	isCommissionEditable: boolean;
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
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<h2 className="font-semibold text-md">Comissões aplicáveis</h2>

				<div className="flex items-center gap-2">
					<Button type="button" variant="outline" onClick={onAddManualCommission}>
						<Plus className="size-4" />
						Adicionar comissão
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={onFetchCommissionScenarios}
						disabled={!hasSelectedProduct || isCommissionScenariosFetching}
					>
						{isCommissionScenariosFetching
							? "Carregando..."
							: hasLoadedCommissionForCurrentProduct
								? "Atualizar comissão"
								: "Buscar comissão"}
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

			<div className="space-y-3">
				{commissionFields.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Nenhuma comissão adicionada.
					</p>
				) : (
					commissionFields.map((commission, commissionIndex) => (
						<SaleCommissionCard
							key={commission.id}
							index={commissionIndex}
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
						/>
					))
				)}
			</div>

			<FieldError error={commissionsError} />
		</Card>
	);
}
