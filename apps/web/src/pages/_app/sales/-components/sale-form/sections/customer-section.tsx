import { Controller, type Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { FieldError } from "@/components/field-error";
import type { SaleFormData, SaleFormInput } from "@/schemas/sale-schema";
import { formatDocument } from "@/utils/format-document";
import { formatPhone } from "@/utils/format-phone";
import type { SaleCustomerOption } from "../types";

interface CustomerSectionProps {
	control: Control<SaleFormInput, unknown, SaleFormData>;
	customersForSelect: SaleCustomerOption[];
	selectedCustomer?: SaleCustomerOption;
	isLoadingOptions: boolean;
	isCustomerLocked: boolean;
	isCreatingQuickCustomer: boolean;
	onUnlockCustomer(): void;
	onOpenQuickCustomerDialog(): void;
}

export function CustomerSection({
	control,
	customersForSelect,
	selectedCustomer,
	isLoadingOptions,
	isCustomerLocked,
	isCreatingQuickCustomer,
	onUnlockCustomer,
	onOpenQuickCustomerDialog,
}: CustomerSectionProps) {
	return (
		<Card className="rounded-sm gap-4 p-5">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div className="space-y-1">
					<h2 className="font-semibold text-md">Cliente</h2>
					<p className="text-muted-foreground text-sm">
						Selecione um cliente existente ou faça um cadastro rápido.
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					onClick={onOpenQuickCustomerDialog}
					disabled={isCreatingQuickCustomer}
				>
					Cadastrar cliente rápido
				</Button>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel className="flex items-center justify-between">
							<span>Cliente *</span>
							{isCustomerLocked ? (
								<Button
									type="button"
									variant="link"
									className="h-auto px-0 text-xs"
									onClick={onUnlockCustomer}
								>
									Alterar cliente
								</Button>
							) : null}
						</FieldLabel>
						<Controller
							control={control}
							name="customerId"
							render={({ field, fieldState }) => (
								<>
									<Select
										value={field.value || undefined}
										onValueChange={field.onChange}
										disabled={
											isLoadingOptions || isCustomerLocked || isCreatingQuickCustomer
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione um cliente" />
										</SelectTrigger>
										<SelectContent>
											{customersForSelect.map((customer) => (
												<SelectItem key={customer.id} value={customer.id}>
													{customer.name}
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

				<div className="rounded-md border bg-muted/20 p-3 space-y-2">
					<p className="font-medium text-sm">Dados base do cliente</p>
					{selectedCustomer ? (
						<div className="space-y-1 text-sm">
							<p>
								<strong>Nome:</strong> {selectedCustomer.name}
							</p>
							<p>
								<strong>
									{selectedCustomer.documentType === "CPF"
										? "CPF"
										: selectedCustomer.documentType}
									:
								</strong>{" "}
								{selectedCustomer.documentType === "CPF"
									? formatDocument({
											type: "CPF",
											value: selectedCustomer.documentNumber,
										})
									: selectedCustomer.documentNumber}
							</p>
							<p>
								<strong>Celular:</strong>{" "}
								{selectedCustomer.phone
									? formatPhone(selectedCustomer.phone)
									: "Não informado"}
							</p>
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							Nenhum cliente selecionado.
						</p>
					)}
				</div>
			</div>
		</Card>
	);
}
