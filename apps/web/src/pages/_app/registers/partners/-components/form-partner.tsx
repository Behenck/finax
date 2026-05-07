import { FieldError } from "@/components/field-error";
import { MobileBottomActionBar } from "@/components/mobile-bottom-action-bar";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/errors/api-error";
import { resolveErrorMessage } from "@/errors";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useApp } from "@/context/app-context";
import {
	getOrganizationsSlugPartnersQueryKey,
	usePostOrganizationsSlugPartners,
	usePutOrganizationsSlugPartnersPartnerid,
	type GetOrganizationsSlugPartnersPartnerid200,
} from "@/http/generated";
import { lookupCompanyDocument } from "@/lib/company-document-lookup";
import { router } from "@/router";
import { partnerSchema, type PartnerForm } from "@/schemas/partner-schema";
import { formatDocument } from "@/utils/format-document";
import { formatPhone } from "@/utils/format-phone";
import { formatTitleCase } from "@/utils/format-title-case";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { PartnerStateSelect } from "./partner-state-select";

interface FormPartnerProps {
	type?: "CREATE" | "UPDATE";
	partner?: GetOrganizationsSlugPartnersPartnerid200["partner"];
}

type CompanyLookupField = keyof Pick<
	PartnerForm,
	| "name"
	| "companyName"
	| "email"
	| "phone"
	| "zipCode"
	| "state"
	| "city"
	| "street"
	| "neighborhood"
	| "number"
	| "complement"
>;

const COMPANY_LOOKUP_FIELD_LABELS: Record<CompanyLookupField, string> = {
	name: "Nome do representante",
	companyName: "Empresa",
	email: "Email",
	phone: "Telefone",
	zipCode: "CEP",
	state: "Estado",
	city: "Cidade",
	street: "Rua",
	neighborhood: "Bairro",
	number: "Número",
	complement: "Complemento",
};

function normalizeValue(value: unknown) {
	return String(value ?? "").trim();
}

function onlyDigits(value?: string | null) {
	return String(value ?? "").replace(/\D/g, "");
}

function formatEmail(value?: string | null) {
	return String(value ?? "")
		.trim()
		.toLowerCase();
}

function normalizePartnerFormData(data: PartnerForm): PartnerForm {
	return {
		...data,
		name: data.name ? formatTitleCase(data.name) : "",
		companyName: formatTitleCase(data.companyName),
		email: formatEmail(data.email),
		city: data.city ? formatTitleCase(data.city) : data.city,
		street: data.street ? formatTitleCase(data.street) : data.street,
		neighborhood: data.neighborhood
			? formatTitleCase(data.neighborhood)
			: data.neighborhood,
	};
}

export function FormPartner({ type = "CREATE", partner }: FormPartnerProps) {
	const { organization } = useApp();
	const queryClient = useQueryClient();
	const lastResolvedCnpjRef = useRef(
		type === "UPDATE" ? onlyDigits(partner?.document) : "",
	);
	const [isLookingUpCompanyDocument, setIsLookingUpCompanyDocument] =
		useState(false);

	const { mutateAsync: createPartner } = usePostOrganizationsSlugPartners();

	const { mutateAsync: updatePartner } =
		usePutOrganizationsSlugPartnersPartnerid();

	const form = useForm<PartnerForm>({
		resolver: zodResolver(partnerSchema),
		defaultValues: {
			name: partner?.name ? formatTitleCase(partner.name) : "",
			email: partner?.email ? formatEmail(partner.email) : "",
			phone: formatPhone(partner?.phone ?? ""),
			companyName: partner?.companyName
				? formatTitleCase(partner.companyName)
				: "",
			documentType: partner?.documentType ?? "CNPJ",
			document: formatDocument({
				type: partner?.documentType ?? "CNPJ",
				value: partner?.document ?? "",
			}),
			country: partner?.country ?? "BR",
			state: partner?.state ?? "RS",
			zipCode: partner?.zipCode ?? "",
			city: partner?.city ? formatTitleCase(partner.city) : "",
			street: partner?.street ? formatTitleCase(partner.street) : "",
			neighborhood: partner?.neighborhood
				? formatTitleCase(partner.neighborhood)
				: "",
			number: partner?.number ?? "",
			complement: partner?.complement ?? "",
		},
	});

	const {
		handleSubmit,
		register,
		control,
		watch,
		setValue,
		getValues,
		formState: { errors, dirtyFields },
	} = form;

	const documentType = watch("documentType");
	const document = watch("document");

	useEffect(() => {
		const digits = onlyDigits(document);

		if (documentType !== "CNPJ" || digits.length !== 14) {
			setIsLookingUpCompanyDocument(false);
			return;
		}

		if (lastResolvedCnpjRef.current === digits) {
			setIsLookingUpCompanyDocument(false);
			return;
		}

		const abortController = new AbortController();
		setIsLookingUpCompanyDocument(true);

		const resolveCompanyDocument = async () => {
			try {
				const companyData = await lookupCompanyDocument(digits, {
					signal: abortController.signal,
				});

				if (!companyData) {
					return;
				}

				lastResolvedCnpjRef.current = digits;

				const nextValues: Record<CompanyLookupField, string> = {
					name: formatTitleCase(companyData.name),
					companyName: formatTitleCase(companyData.companyName),
					email: formatEmail(companyData.email),
					phone: formatPhone(companyData.phone),
					zipCode: companyData.zipCode,
					state: companyData.state.toUpperCase(),
					city: formatTitleCase(companyData.city),
					street: formatTitleCase(companyData.street),
					neighborhood: formatTitleCase(companyData.neighborhood),
					number: companyData.number,
					complement: companyData.complement,
				};

				const nextEntries = (
					Object.entries(nextValues) as Array<[CompanyLookupField, string]>
				).filter(([, value]) => normalizeValue(value).length > 0);

				const conflictingFields = nextEntries.filter(([field, nextValue]) => {
					const currentValue = normalizeValue(getValues(field));
					const normalizedNextValue = normalizeValue(nextValue);
					if (!currentValue || currentValue === normalizedNextValue) {
						return false;
					}

					if (
						type === "CREATE" &&
						field === "state" &&
						currentValue === "RS" &&
						!dirtyFields.state
					) {
						return false;
					}

					return true;
				});

				if (conflictingFields.length > 0) {
					const fieldNames = conflictingFields
						.map(([field]) => COMPANY_LOOKUP_FIELD_LABELS[field])
						.join(", ");
					const shouldOverwrite = window.confirm(
						`Encontramos dados para este CNPJ. Deseja substituir os campos já preenchidos (${fieldNames})?`,
					);

					if (!shouldOverwrite) {
						return;
					}
				}

				for (const [field, value] of nextEntries) {
					setValue(field, value, {
						shouldDirty: true,
						shouldValidate: true,
					});
				}

				toast.success("Dados do CNPJ preenchidos automaticamente.");
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") {
					return;
				}
			} finally {
				if (!abortController.signal.aborted) {
					setIsLookingUpCompanyDocument(false);
				}
			}
		};

		void resolveCompanyDocument();

		return () => {
			abortController.abort();
		};
	}, [dirtyFields.state, document, documentType, getValues, setValue, type]);

	async function onSubmit(data: PartnerForm) {
		const normalizedData = normalizePartnerFormData(data);

		try {
			if (type === "CREATE") {
				const response = await createPartner(
					{
						slug: organization!.slug,
						data: normalizedData,
					},
					{
						onSuccess: async () => {
							await queryClient.invalidateQueries({
								queryKey: getOrganizationsSlugPartnersQueryKey({
									slug: organization!.slug,
								}),
							});
						},
					},
				);

				toast.success("Parceiro cadastrado com sucesso");

				form.reset();

				router.navigate({
					to: "/registers/partners/update",
					search: { partnerId: response.partnerId },
				});

				return;
			}

			await updatePartner(
				{
					slug: organization!.slug,
					partnerId: partner!.id,
					data: normalizedData,
				},
				{
					onSuccess: async () => {
						await queryClient.invalidateQueries({
							queryKey: getOrganizationsSlugPartnersQueryKey({
								slug: organization!.slug,
							}),
						});
					},
				},
			);

			toast.success("Parceiro atualizado com sucesso");
		} catch (err) {
			toast.error(resolveErrorMessage(normalizeApiError(err)));
		}
	}

	return (
		<FormProvider {...form}>
			<form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<FieldGroup className="md:max-w-48">
						<Field className="gap-1">
							<FieldLabel>Tipo de documento</FieldLabel>
							<Controller
								name="documentType"
								control={control}
								render={({ field, fieldState }) => (
									<>
										<Select
											value={field.value ?? ""}
											onValueChange={(value) => {
												const nextDocumentType =
													value as PartnerForm["documentType"];
												field.onChange(nextDocumentType);
												lastResolvedCnpjRef.current = "";
												setValue(
													"document",
													formatDocument({
														type: nextDocumentType,
														value: getValues("document"),
													}),
													{
														shouldDirty: true,
														shouldValidate: true,
													},
												);
											}}
										>
											<SelectTrigger className="w-full">
												<SelectValue placeholder="Selecione" />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													<SelectItem value="CPF">CPF</SelectItem>
													<SelectItem value="CNPJ">CNPJ</SelectItem>
												</SelectGroup>
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
							<FieldLabel>CNPJ / CPF</FieldLabel>
							<Controller
								control={control}
								name="document"
								render={({ field, fieldState }) => (
									<>
										<Input
											placeholder={
												documentType === "CPF"
													? "000.000.000-00"
													: "00.000.000/0000-00"
											}
											value={field.value ?? ""}
											onChange={(e) =>
												field.onChange(
													formatDocument({
														type: documentType,
														value: e.target.value,
													}),
												)
											}
										/>
										<FieldError error={fieldState.error} />
										{isLookingUpCompanyDocument ? (
											<p
												className="text-muted-foreground text-xs"
												role="status"
											>
												Buscando dados do CNPJ...
											</p>
										) : null}
									</>
								)}
							/>
						</Field>
					</FieldGroup>
				</div>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Nome do representante</FieldLabel>
							<Controller
								control={control}
								name="name"
								render={({ field, fieldState }) => (
									<>
										<Input
											placeholder="Ex: João da Silva"
											value={field.value ?? ""}
											onChange={(event) =>
												field.onChange(formatTitleCase(event.target.value))
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
							<FieldLabel>Empresa *</FieldLabel>
							<Controller
								control={control}
								name="companyName"
								render={({ field, fieldState }) => (
									<>
										<Input
											placeholder="Ex: Silva LTDA"
											value={field.value ?? ""}
											onChange={(event) =>
												field.onChange(formatTitleCase(event.target.value))
											}
										/>
										<FieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>
				</div>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Email</FieldLabel>
							<Controller
								control={control}
								name="email"
								render={({ field, fieldState }) => (
									<>
										<Input
											placeholder="Ex: joao.silva@empresa.com"
											value={field.value ?? ""}
											onChange={(event) =>
												field.onChange(formatEmail(event.target.value))
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
							<FieldLabel>Telefone para contato</FieldLabel>
							<Controller
								control={control}
								name="phone"
								render={({ field, fieldState }) => (
									<>
										<Input
											placeholder="(00) 00000-0000"
											value={field.value ?? ""}
											onChange={(e) =>
												field.onChange(formatPhone(e.target.value))
											}
										/>
										<FieldError error={fieldState.error} />
									</>
								)}
							/>
						</Field>
					</FieldGroup>
				</div>
				<Separator />
				<div className="space-y-4">
					<h3 className="text-muted-foreground text-sm">Endereço</h3>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<FieldGroup>
							<Field className="gap-1">
								<FieldLabel>CEP</FieldLabel>
								<Input placeholder="Ex: 00000-000" {...register("zipCode")} />
								<FieldError error={errors.zipCode} />
							</Field>
						</FieldGroup>
						<FieldGroup>
							<Field className="gap-1">
								<FieldLabel>País *</FieldLabel>
								<Controller
									name="country"
									control={control}
									render={({ field, fieldState }) => (
										<>
											<Select
												value={field.value ?? ""}
												onValueChange={field.onChange}
											>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="Selecione" />
												</SelectTrigger>
												<SelectContent>
													<SelectGroup>
														<SelectItem value="BR">Brasil</SelectItem>
													</SelectGroup>
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
								<FieldLabel>Estado *</FieldLabel>
								<Controller
									name="state"
									control={control}
									render={({ field, fieldState }) => (
										<>
											<PartnerStateSelect
												value={field.value ?? ""}
												onChange={field.onChange}
											/>
											<FieldError error={fieldState.error} />
										</>
									)}
								/>
							</Field>
						</FieldGroup>
						<FieldGroup>
							<Field className="gap-1">
								<FieldLabel>Cidade</FieldLabel>
								<Controller
									control={control}
									name="city"
									render={({ field, fieldState }) => (
										<>
											<Input
												placeholder="Ex: Uruguaiana"
												value={field.value ?? ""}
												onChange={(event) =>
													field.onChange(formatTitleCase(event.target.value))
												}
											/>
											<FieldError error={fieldState.error} />
										</>
									)}
								/>
							</Field>
						</FieldGroup>
					</div>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<FieldGroup>
							<Field className="gap-1">
								<FieldLabel>Rua</FieldLabel>
								<Controller
									control={control}
									name="street"
									render={({ field, fieldState }) => (
										<>
											<Input
												placeholder="Ex: Av. Presidente"
												value={field.value ?? ""}
												onChange={(event) =>
													field.onChange(formatTitleCase(event.target.value))
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
								<FieldLabel>Bairro</FieldLabel>
								<Controller
									control={control}
									name="neighborhood"
									render={({ field, fieldState }) => (
										<>
											<Input
												placeholder="Ex: Centro"
												value={field.value ?? ""}
												onChange={(event) =>
													field.onChange(formatTitleCase(event.target.value))
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
								<FieldLabel>Número</FieldLabel>
								<Input placeholder="Ex: 123" {...register("number")} />
								<FieldError error={errors.number} />
							</Field>
						</FieldGroup>
						<FieldGroup>
							<Field className="gap-1">
								<FieldLabel>Complemento</FieldLabel>
								<Input
									placeholder="Ex: Escritório"
									{...register("complement")}
								/>
								<FieldError error={errors.complement} />
							</Field>
						</FieldGroup>
					</div>
				</div>
				<div className="hidden justify-end gap-2 md:flex">
					<Button type="button" variant="outline" asChild>
						<Link to="/registers/partners">Cancelar</Link>
					</Button>
					<Button type="submit">
						{type === "CREATE" ? "Cadastrar Parceiro" : "Atualizar Parceiro"}
					</Button>
				</div>
				<MobileBottomActionBar>
					<div className="grid grid-cols-2 gap-2">
						<Button type="button" variant="outline" asChild>
							<Link to="/registers/partners">Cancelar</Link>
						</Button>
						<Button type="submit">
							{type === "CREATE" ? "Cadastrar Parceiro" : "Atualizar Parceiro"}
						</Button>
					</div>
				</MobileBottomActionBar>
				<div className="h-20 md:hidden" />
			</form>
		</FormProvider>
	);
}
