import { Controller, type UseFormReturn } from "react-hook-form";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDocument } from "@/utils/format-document";
import { formatPhone } from "@/utils/format-phone";
import type {
	QuickCustomerData,
	QuickCustomerInput,
} from "../quick-customer-schema";
import {
	normalizeQuickCustomerName,
	resolveQuickCustomerDocumentMaskType,
} from "../quick-customer-schema";

interface QuickCustomerDialogProps {
	open: boolean;
	onOpenChange(open: boolean): void;
	form: UseFormReturn<QuickCustomerInput, unknown, QuickCustomerData>;
	isPending: boolean;
	onSubmit(data: QuickCustomerData): void | Promise<void>;
}

export function QuickCustomerDialog({
	open,
	onOpenChange,
	form,
	isPending,
	onSubmit,
}: QuickCustomerDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Cadastrar cliente rápido</DialogTitle>
					<DialogDescription>
						Cria um cliente com dados base (nome, CPF/CNPJ e celular).
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Nome completo *</FieldLabel>
							<Controller
								control={form.control}
								name="name"
								render={({ field, fieldState }) => (
									<>
										<Input
											value={field.value ?? ""}
											onChange={(event) =>
												field.onChange(
													normalizeQuickCustomerName(event.target.value),
												)
											}
											onBlur={field.onBlur}
											ref={field.ref}
										/>
										<FieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>

					<div className="grid gap-4 md:grid-cols-2">
						<FieldGroup>
							<Field className="gap-1">
								<FieldLabel>CPF/CNPJ *</FieldLabel>
								<Controller
									control={form.control}
									name="documentNumber"
									render={({ field, fieldState }) => (
										<>
											<Input
												placeholder="000.000.000-00 ou 00.000.000/0000-00"
												value={field.value ?? ""}
												onChange={(event) =>
													field.onChange(
														formatDocument({
															type: resolveQuickCustomerDocumentMaskType(
																event.target.value,
															),
															value: event.target.value,
														}),
													)
												}
											/>
											<FieldError error={fieldState.error} />
										</>
									)}
								/>
							</Field>
						</FieldGroup>

						<FieldGroup>
							<Field className="gap-1">
								<FieldLabel>Celular</FieldLabel>
								<Controller
									control={form.control}
									name="phone"
									render={({ field, fieldState }) => (
										<>
											<Input
												placeholder="(00) 00000-0000"
												value={field.value ?? ""}
												onChange={(event) =>
													field.onChange(formatPhone(event.target.value))
												}
											/>
											<FieldError error={fieldState.error} />
										</>
									)}
								/>
							</Field>
						</FieldGroup>
					</div>
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						Cancelar
					</Button>
					<Button
						type="button"
						onClick={form.handleSubmit(onSubmit)}
						disabled={isPending}
					>
						{isPending ? "Cadastrando..." : "Cadastrar cliente"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
