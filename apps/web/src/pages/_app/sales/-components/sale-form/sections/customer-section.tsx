import { useMemo } from "react";
import { Controller, type Control } from "react-hook-form";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SaleFormData, SaleFormInput } from "@/schemas/sale-schema";
import { formatDocument } from "@/utils/format-document";
import { formatPhone } from "@/utils/format-phone";
import {
	filterCustomersForSaleSearch,
	MIN_SALE_CUSTOMER_SEARCH_LENGTH,
	normalizeCustomerSearchValue,
} from "../customer-search";
import type { SaleCustomerOption } from "../types";
import { Plus } from "lucide-react";

interface CustomerSectionProps {
	control: Control<SaleFormInput, unknown, SaleFormData>;
	customersForSelect: SaleCustomerOption[];
	selectedCustomer?: SaleCustomerOption;
	customerQuery: string;
	isQueryingCustomers: boolean;
	isLoadingOptions: boolean;
	isCustomerLocked: boolean;
	isCreatingQuickCustomer: boolean;
	onCustomerQueryChange(value: string): void;
	onSelectCustomer(customerId: string): void;
	onOpenEditSelectedCustomer(customerId: string): void;
	onUnlockCustomer(): void;
	onOpenQuickCustomerDialog(): void;
}

export function CustomerSection({
	control,
	customersForSelect,
	selectedCustomer,
	customerQuery,
	isQueryingCustomers,
	isLoadingOptions,
	isCustomerLocked,
	isCreatingQuickCustomer,
	onCustomerQueryChange,
	onSelectCustomer,
	onOpenEditSelectedCustomer,
	onUnlockCustomer,
	onOpenQuickCustomerDialog,
}: CustomerSectionProps) {
	const trimmedQuery = customerQuery.trim();
	const normalizedQuery = normalizeCustomerSearchValue(customerQuery);
	const hasMinimumQueryLength =
		normalizedQuery.length >= MIN_SALE_CUSTOMER_SEARCH_LENGTH;
	const suggestedCustomers = useMemo(
		() => filterCustomersForSaleSearch(customersForSelect, customerQuery),
		[customersForSelect, customerQuery],
	);
	const isCustomerInputDisabled =
		isLoadingOptions || isCustomerLocked || isCreatingQuickCustomer;
	const shouldShowSearchFeedback =
		!isCustomerInputDisabled && isQueryingCustomers;

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
					<Plus />
					<span>Adicionar cliente</span>
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
							render={({ fieldState }) => (
								<>
									<Input
										value={customerQuery}
										onChange={(event) =>
											onCustomerQueryChange(event.target.value)
										}
										placeholder="Digite o nome, documento ou celular do cliente"
										disabled={isCustomerInputDisabled}
									/>
									{shouldShowSearchFeedback ? (
										<div className="space-y-2">
											{hasMinimumQueryLength ? (
												<div className="max-h-64 overflow-y-auto rounded-md border">
													{suggestedCustomers.length === 0 ? (
														<p className="p-2 text-sm text-muted-foreground">
															Nenhum cliente encontrado.
														</p>
													) : (
														suggestedCustomers.map((customer) => {
															const isSelected = selectedCustomer?.id === customer.id;
															const customerDocumentLabel =
																customer.documentType === "CPF"
																	? formatDocument({
																			type: "CPF",
																			value: customer.documentNumber,
																		})
																	: customer.documentNumber;
															const customerPhoneLabel = customer.phone
																? formatPhone(customer.phone)
																: "Sem celular";

															return (
																<button
																	key={customer.id}
																	type="button"
																	className={cn(
																		"flex w-full flex-col items-start gap-0.5 px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
																		isSelected && "bg-accent",
																	)}
																	onClick={() => onSelectCustomer(customer.id)}
																>
																	<span className="font-medium">{customer.name}</span>
																	<span className="text-xs text-muted-foreground">
																		{customerDocumentLabel} • {customerPhoneLabel}
																	</span>
																</button>
															);
														})
													)}
												</div>
											) : trimmedQuery.length > 0 ? (
												<p className="text-muted-foreground text-xs">
													Digite pelo menos {MIN_SALE_CUSTOMER_SEARCH_LENGTH}{" "}
													letras para buscar clientes.
												</p>
											) : null}
										</div>
									) : null}
									<FieldError error={fieldState.error} />
								</>
							)}
						/>
					</Field>
				</FieldGroup>

				<div className="rounded-md border bg-muted/20 p-3 space-y-2">
					<div className="flex items-center justify-between gap-2">
						<p className="font-medium text-sm">Dados base do cliente</p>
						{selectedCustomer ? (
							<Button
								type="button"
								variant="link"
								className="h-auto px-0 text-xs"
								onClick={() => onOpenEditSelectedCustomer(selectedCustomer.id)}
							>
								Editar cliente
							</Button>
						) : null}
					</div>
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
