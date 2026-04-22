import { Controller, type Control } from "react-hook-form";
import { LoadingReveal } from "@/components/loading-reveal";
import { CardSectionSkeleton } from "@/components/loading-skeletons";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { FieldError } from "@/components/field-error";
import type { SaleFormData, SaleFormInput } from "@/schemas/sale-schema";
import type { SaleDynamicFieldSchemaItem } from "@/schemas/types/sale-dynamic-fields";
import { formatCurrencyBRL } from "@/utils/format-amount";
import { formatPhone } from "@/utils/format-phone";
import { RichTextEditor } from "../../rich-text-editor";
import { OPTIONAL_NONE_VALUE } from "../constants";

interface DynamicFieldsSectionProps {
	control: Control<SaleFormInput, unknown, SaleFormData>;
	selectedProductId: string;
	isDynamicFieldsLoading: boolean;
	dynamicFieldSchema: SaleDynamicFieldSchemaItem[];
}

export function DynamicFieldsSection({
	control,
	selectedProductId,
	isDynamicFieldsLoading,
	dynamicFieldSchema,
}: DynamicFieldsSectionProps) {
	return (
		<Card className="rounded-sm gap-4 p-5">
			<h2 className="font-semibold text-md">Campos personalizados</h2>

			{!selectedProductId ? (
				<p className="text-sm text-muted-foreground">
					Selecione um produto para carregar os campos personalizados.
				</p>
			) : dynamicFieldSchema.length === 0 ? (
				<LoadingReveal
					loading={isDynamicFieldsLoading}
					skeleton={
						<CardSectionSkeleton
							rows={4}
							cardClassName="border-dashed p-4 shadow-none"
						/>
					}
					contentKey={`${selectedProductId}-${dynamicFieldSchema.length}`}
				>
					<p className="text-sm text-muted-foreground">
						Este produto não possui campos personalizados.
					</p>
				</LoadingReveal>
			) : (
				<LoadingReveal
					loading={isDynamicFieldsLoading}
					skeleton={
						<CardSectionSkeleton
							rows={4}
							cardClassName="border-dashed p-4 shadow-none"
						/>
					}
					contentKey={`${selectedProductId}-${dynamicFieldSchema.length}`}
				>
					<div className="grid gap-4 md:grid-cols-2">
						{dynamicFieldSchema.map((dynamicField) => (
							<FieldGroup
								key={dynamicField.fieldId}
								className={
									dynamicField.type === "RICH_TEXT"
										? "md:col-span-2"
										: undefined
								}
							>
								<Field className="gap-2">
									<FieldLabel>
										{dynamicField.label}
										{dynamicField.required ? " *" : ""}
									</FieldLabel>

									<Controller
										control={control}
										name={`dynamicFields.${dynamicField.fieldId}`}
										render={({ field, fieldState }) => {
											const rawValue = field.value;

											if (dynamicField.type === "TEXT") {
												return (
													<>
														<Input
															placeholder="Digite o texto"
															value={
																typeof rawValue === "string" ? rawValue : ""
															}
															onChange={(event) =>
																field.onChange(event.target.value)
															}
														/>
														<FieldError error={fieldState.error} />
													</>
												);
											}

											if (dynamicField.type === "NUMBER") {
												return (
													<>
														<Input
															type="number"
															step="any"
															value={
																typeof rawValue === "string" ? rawValue : ""
															}
															onChange={(event) =>
																field.onChange(event.target.value)
															}
														/>
														<FieldError error={fieldState.error} />
													</>
												);
											}

											if (dynamicField.type === "CURRENCY") {
												return (
													<>
														<Input
															placeholder="R$ 0,00"
															value={
																typeof rawValue === "string" ? rawValue : ""
															}
															onChange={(event) =>
																field.onChange(
																	formatCurrencyBRL(event.target.value),
																)
															}
														/>
														<FieldError error={fieldState.error} />
													</>
												);
											}

											if (dynamicField.type === "RICH_TEXT") {
												return (
													<>
														<RichTextEditor
															value={
																typeof rawValue === "string" ? rawValue : ""
															}
															onChange={field.onChange}
														/>
														<FieldError error={fieldState.error} />
													</>
												);
											}

											if (dynamicField.type === "PHONE") {
												return (
													<>
														<Input
															placeholder="(00) 00000-0000"
															value={
																typeof rawValue === "string" ? rawValue : ""
															}
															onChange={(event) =>
																field.onChange(formatPhone(event.target.value))
															}
														/>
														<FieldError error={fieldState.error} />
													</>
												);
											}

											if (dynamicField.type === "SELECT") {
												return (
													<>
														<Select
															value={
																typeof rawValue === "string" && rawValue
																	? rawValue
																	: OPTIONAL_NONE_VALUE
															}
															onValueChange={(value) =>
																field.onChange(
																	value === OPTIONAL_NONE_VALUE ? "" : value,
																)
															}
														>
															<SelectTrigger>
																<SelectValue placeholder="Selecione uma opção" />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value={OPTIONAL_NONE_VALUE}>
																	Sem seleção
																</SelectItem>
																{dynamicField.options.map((option) => (
																	<SelectItem key={option.id} value={option.id}>
																		{option.label}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
														<FieldError error={fieldState.error} />
													</>
												);
											}

											if (dynamicField.type === "MULTI_SELECT") {
												const selectedValues = Array.isArray(rawValue)
													? rawValue.filter(
															(option): option is string =>
																typeof option === "string",
														)
													: [];

												return (
													<>
														<div className="space-y-2">
															{dynamicField.options.map((option) => {
																const checked = selectedValues.includes(
																	option.id,
																);

																return (
																	<label
																		key={option.id}
																		className="flex items-center gap-2 text-sm"
																	>
																		<Checkbox
																			checked={checked}
																			onCheckedChange={(isChecked) => {
																				if (isChecked) {
																					field.onChange([
																						...selectedValues,
																						option.id,
																					]);
																					return;
																				}

																				field.onChange(
																					selectedValues.filter(
																						(value) => value !== option.id,
																					),
																				);
																			}}
																		/>
																		<span>{option.label}</span>
																	</label>
																);
															})}
														</div>
														<FieldError error={fieldState.error} />
													</>
												);
											}

											if (dynamicField.type === "DATE") {
												return (
													<>
														<CalendarDateInput
															value={
																typeof rawValue === "string" ? rawValue : ""
															}
															onChange={field.onChange}
														/>
														<FieldError error={fieldState.error} />
													</>
												);
											}

											if (dynamicField.type === "DATE_TIME") {
												return (
													<>
														<Input
															type="datetime-local"
															value={
																typeof rawValue === "string" ? rawValue : ""
															}
															onChange={(event) =>
																field.onChange(event.target.value)
															}
														/>
														<FieldError error={fieldState.error} />
													</>
												);
											}

											return (
												<>
													<Input
														value={typeof rawValue === "string" ? rawValue : ""}
														onChange={(event) =>
															field.onChange(event.target.value)
														}
													/>
													<FieldError error={fieldState.error} />
												</>
											);
										}}
									/>
								</Field>
							</FieldGroup>
						))}
					</div>
				</LoadingReveal>
			)}
		</Card>
	);
}
