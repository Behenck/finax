import { Controller, type Control } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { FieldError } from "@/components/field-error";
import type { SaleFormData, SaleFormInput } from "@/schemas/sale-schema";
import {
	SALE_RESPONSIBLE_TYPE_LABEL,
	type SaleResponsibleType,
} from "@/schemas/types/sales";
import { OPTIONAL_NONE_VALUE } from "../constants";

interface ClassificationSectionProps {
	control: Control<SaleFormInput, unknown, SaleFormData>;
	companies: Array<{
		id: string;
		name: string;
	}>;
	companyUnits: Array<{
		id: string;
		name: string;
	}>;
	responsibles: Array<{
		id: string;
		name: string;
		status?: "ACTIVE" | "INACTIVE";
	}>;
	selectedCompanyId: string;
	selectedResponsibleType: SaleResponsibleType;
	isLoadingOptions: boolean;
}

export function ClassificationSection({
	control,
	companies,
	companyUnits,
	responsibles,
	selectedCompanyId,
	selectedResponsibleType,
	isLoadingOptions,
}: ClassificationSectionProps) {
	const responsibleOptions = responsibles.map((responsible) => ({
		value: responsible.id,
		label: responsible.name,
		group:
			selectedResponsibleType === "PARTNER"
				? responsible.status === "INACTIVE"
					? "Inativos"
					: "Ativos"
				: undefined,
	}));

	return (
		<Card className="rounded-sm gap-4 p-5">
			<h2 className="font-semibold text-md">Classificação da Venda</h2>

			<div className="grid gap-4 md:grid-cols-2">
				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel>Empresa *</FieldLabel>
						<Controller
							control={control}
							name="companyId"
							render={({ field, fieldState }) => (
								<>
									<SearchableSelect
										options={companies.map((company) => ({
											value: company.id,
											label: company.name,
										}))}
										value={field.value || undefined}
										onValueChange={field.onChange}
										disabled={isLoadingOptions}
										placeholder="Selecione uma empresa"
										searchPlaceholder="Buscar empresa..."
										emptyMessage="Nenhuma empresa encontrada."
									/>
									<FieldError error={fieldState.error} />
								</>
							)}
						/>
					</Field>
				</FieldGroup>

				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel>Unidade</FieldLabel>
						<Controller
							control={control}
							name="unitId"
							render={({ field, fieldState }) => (
								<>
									<SearchableSelect
										options={companyUnits.map((unit) => ({
											value: unit.id,
											label: unit.name,
										}))}
										value={
											(field.value as string | undefined) || OPTIONAL_NONE_VALUE
										}
										onValueChange={(value) =>
											field.onChange(
												value === OPTIONAL_NONE_VALUE ? "" : value,
											)
										}
										disabled={isLoadingOptions || !selectedCompanyId}
										placeholder="Selecione uma unidade"
										searchPlaceholder="Buscar unidade..."
										emptyMessage="Nenhuma unidade encontrada."
										clearOption={{
											value: OPTIONAL_NONE_VALUE,
											label: "Sem unidade",
										}}
									/>
									<FieldError error={fieldState.error} />
								</>
							)}
						/>
					</Field>
				</FieldGroup>

				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel>Tipo de responsável *</FieldLabel>
						<Controller
							control={control}
							name="responsibleType"
							render={({ field, fieldState }) => (
								<>
									<Select
										value={field.value || "SELLER"}
										onValueChange={(value) =>
											field.onChange(value as SaleResponsibleType)
										}
										disabled={isLoadingOptions}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="SELLER">
												{SALE_RESPONSIBLE_TYPE_LABEL.SELLER}
											</SelectItem>
											<SelectItem value="PARTNER">
												{SALE_RESPONSIBLE_TYPE_LABEL.PARTNER}
											</SelectItem>
										</SelectContent>
									</Select>
									<FieldError error={fieldState.error} />
								</>
							)}
						/>
					</Field>
				</FieldGroup>

				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel>
							{selectedResponsibleType === "PARTNER"
								? "Parceiro *"
								: "Vendedor *"}
						</FieldLabel>
						<Controller
							control={control}
							name="responsibleId"
							render={({ field, fieldState }) => (
								<>
									<SearchableSelect
										options={responsibleOptions}
										value={field.value || undefined}
										onValueChange={field.onChange}
										disabled={isLoadingOptions}
										placeholder="Selecione o responsável"
										searchPlaceholder={`Buscar ${
											selectedResponsibleType === "PARTNER"
												? "parceiro"
												: "vendedor"
										}...`}
										emptyMessage="Nenhum responsável encontrado."
									/>
									<FieldError error={fieldState.error} />
								</>
							)}
						/>
					</Field>
				</FieldGroup>
			</div>
		</Card>
	);
}
