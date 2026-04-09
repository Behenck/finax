import { Controller, type Control } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
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
	const activePartnerResponsibles = responsibles.filter(
		(responsible) => responsible.status !== "INACTIVE",
	);
	const inactivePartnerResponsibles = responsibles.filter(
		(responsible) => responsible.status === "INACTIVE",
	);

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
									<Select
										value={field.value || undefined}
										onValueChange={field.onChange}
										disabled={isLoadingOptions}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione uma empresa" />
										</SelectTrigger>
										<SelectContent>
											{companies.map((company) => (
												<SelectItem key={company.id} value={company.id}>
													{company.name}
												</SelectItem>
											))}
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
						<FieldLabel>Unidade</FieldLabel>
						<Controller
							control={control}
							name="unitId"
							render={({ field, fieldState }) => (
								<>
									<Select
										value={
											(field.value as string | undefined) || OPTIONAL_NONE_VALUE
										}
										onValueChange={(value) =>
											field.onChange(
												value === OPTIONAL_NONE_VALUE ? "" : value,
											)
										}
										disabled={isLoadingOptions || !selectedCompanyId}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione uma unidade" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={OPTIONAL_NONE_VALUE}>
												Sem unidade
											</SelectItem>
											{companyUnits.map((unit) => (
												<SelectItem key={unit.id} value={unit.id}>
													{unit.name}
												</SelectItem>
											))}
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
									<Select
										value={field.value || undefined}
										onValueChange={field.onChange}
										disabled={isLoadingOptions}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione o responsável" />
										</SelectTrigger>
										<SelectContent>
											{selectedResponsibleType === "PARTNER" ? (
												<>
													<SelectGroup>
														<SelectLabel>Ativos</SelectLabel>
														{activePartnerResponsibles.map((responsible) => (
															<SelectItem
																key={responsible.id}
																value={responsible.id}
															>
																{responsible.name}
															</SelectItem>
														))}
													</SelectGroup>
													{inactivePartnerResponsibles.length > 0 ? (
														<>
															<SelectSeparator />
															<SelectGroup>
																<SelectLabel>Inativos</SelectLabel>
																{inactivePartnerResponsibles.map((responsible) => (
																	<SelectItem
																		key={responsible.id}
																		value={responsible.id}
																	>
																		{responsible.name}
																	</SelectItem>
																))}
															</SelectGroup>
														</>
													) : null}
												</>
											) : (
												responsibles.map((responsible) => (
													<SelectItem
														key={responsible.id}
														value={responsible.id}
													>
														{responsible.name}
													</SelectItem>
												))
											)}
										</SelectContent>
									</Select>
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
