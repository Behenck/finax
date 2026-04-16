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
import { router } from "@/router";
import { partnerSchema, type PartnerForm } from "@/schemas/partner-schema";
import { formatDocument } from "@/utils/format-document";
import { formatPhone } from "@/utils/format-phone";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

interface FormPartnerProps {
	type?: "CREATE" | "UPDATE";
	partner?: GetOrganizationsSlugPartnersPartnerid200["partner"];
}

export function FormPartner({ type = "CREATE", partner }: FormPartnerProps) {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	const { mutateAsync: createPartner } = usePostOrganizationsSlugPartners();

	const { mutateAsync: updatePartner } =
		usePutOrganizationsSlugPartnersPartnerid();

	const form = useForm<PartnerForm>({
		resolver: zodResolver(partnerSchema),
		defaultValues: {
			name: partner?.name ?? "",
			email: partner?.email ?? "",
			phone: formatPhone(partner?.phone ?? ""),
			companyName: partner?.companyName ?? "",
			documentType: partner?.documentType ?? "CNPJ",
			document: formatDocument({
				type: partner?.documentType ?? "CNPJ",
				value: partner?.document ?? "",
			}),
			country: partner?.country ?? "BR",
			state: partner?.state ?? "RS",
			zipCode: partner?.zipCode ?? "",
			city: partner?.city ?? "",
			street: partner?.street ?? "",
			neighborhood: partner?.neighborhood ?? "",
			number: partner?.number ?? "",
			complement: partner?.complement ?? "",
		},
	});

	const {
		handleSubmit,
		register,
		control,
		watch,
		formState: { errors },
	} = form;

	const documentType = watch("documentType");

	async function onSubmit(data: PartnerForm) {
		try {
			if (type === "CREATE") {
				const response = await createPartner(
					{
						slug: organization!.slug,
						data,
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
					data,
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
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Nome do representante *</FieldLabel>
							<Input placeholder="Ex: João da Silva" {...register("name")} />
							<FieldError error={errors.name} />
						</Field>
					</FieldGroup>
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Empresa *</FieldLabel>
							<Input
								placeholder="Ex: Silva LTDA"
								{...register("companyName")}
							/>
							<FieldError error={errors.companyName} />
						</Field>
					</FieldGroup>
				</div>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>email *</FieldLabel>
							<Input
								placeholder="Ex: joao.silva@empresa.com"
								{...register("email")}
							/>
							<FieldError error={errors.email} />
						</Field>
					</FieldGroup>
					<FieldGroup>
						<Field className="gap-1">
							<FieldLabel>Telefone para contato *</FieldLabel>
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
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<FieldGroup className="w-40">
						<Field className="gap-1">
							<FieldLabel>Tipo de documento *</FieldLabel>
							<Controller
								name="documentType"
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
					<FieldGroup className="flex-1">
						<Field className="gap-1">
							<FieldLabel>CNPJ / CPF *</FieldLabel>
							<Controller
								control={control}
								name="document"
								render={({ field, fieldState }) => (
									<>
										<Input
											placeholder="00.000.000/0000-00"
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
											<Select
												value={field.value ?? ""}
												onValueChange={field.onChange}
											>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="Selecione" />
												</SelectTrigger>
												<SelectContent>
													<SelectGroup>
														<SelectItem value="RS">
															Rio Grande do Sul
														</SelectItem>
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
								<FieldLabel>Cidade</FieldLabel>
								<Input placeholder="Ex: Uruguaiana" {...register("city")} />
								<FieldError error={errors.city} />
							</Field>
						</FieldGroup>
					</div>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<FieldGroup>
							<Field className="gap-1">
								<FieldLabel>Bairro</FieldLabel>
								<Input placeholder="Ex: Centro" {...register("street")} />
								<FieldError error={errors.street} />
							</Field>
						</FieldGroup>
						<FieldGroup>
							<Field className="gap-1">
								<FieldLabel>Rua</FieldLabel>
								<Input
									placeholder="Ex: Av. Presidente"
									{...register("neighborhood")}
								/>
								<FieldError error={errors.neighborhood} />
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
