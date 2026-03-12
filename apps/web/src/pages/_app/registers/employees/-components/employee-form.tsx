import { Button } from "@/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MobileBottomActionBar } from "@/components/mobile-bottom-action-bar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugEmployeesQueryOptions,
	getOrganizationsSlugEmployeesQueryKey,
	useGetOrganizationsSlugCompanies,
	usePostOrganizationsSlugEmployees,
	usePutOrganizationsSlugEmployeesEmployeeid,
} from "@/http/generated";
import {
	employeeSchema,
	type EmployeeFormData,
} from "@/schemas/employee-schema";
import type { Employee } from "@/schemas/types/employee";
import { formatDocument } from "@/utils/format-document";
import { formatPhone } from "@/utils/format-phone";
import { formatTitleCase } from "@/utils/format-title-case";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

interface CreateEmployeeFormProps {
	onSuccess?: () => void;
	mode?: "create" | "edit";
	initialData?: Employee;
}

const PIX_KEY_TYPE_OPTIONS = [
	{ value: "CPF", label: "CPF" },
	{ value: "CNPJ", label: "CNPJ" },
	{ value: "EMAIL", label: "E-mail" },
	{ value: "PHONE", label: "Telefone" },
	{ value: "RANDOM", label: "Chave aleatória" },
] as const;

type ViaCepResponse = {
	cep?: string;
	logradouro?: string;
	complemento?: string;
	bairro?: string;
	localidade?: string;
	uf?: string;
	erro?: boolean;
};

function formatZipCode(value: string) {
	const digits = value.replace(/\D/g, "").slice(0, 8);

	if (digits.length <= 5) return digits;

	return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function EmployeeForm({
	onSuccess,
	mode,
	initialData,
}: CreateEmployeeFormProps) {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	const { mutateAsync: createEmployee } = usePostOrganizationsSlugEmployees();
	const { mutateAsync: updateEmployee } =
		usePutOrganizationsSlugEmployeesEmployeeid();

	const { data } = useGetOrganizationsSlugCompanies({ slug: organization!.slug });

	const { handleSubmit, control, setValue } = useForm<EmployeeFormData>({
		resolver: zodResolver(employeeSchema),
		defaultValues: {
			name: initialData?.name ?? "",
			email: initialData?.email ?? "",
			phone: initialData?.phone ?? "",
			role: initialData?.role ?? "",
			department: initialData?.department ?? "",
			cpf: initialData?.cpf ?? "",
			pixKeyType: initialData?.pixKeyType ?? undefined,
			pixKey: initialData?.pixKey ?? "",
			paymentNotes: initialData?.paymentNotes ?? "",
			country: initialData?.country ?? "",
			state: initialData?.state ?? "",
			city: initialData?.city ?? "",
			street: initialData?.street ?? "",
			zipCode: initialData?.zipCode ?? "",
			neighborhood: initialData?.neighborhood ?? "",
			number: initialData?.number ?? "",
			complement: initialData?.complement ?? "",
			companyId: initialData?.company.id ?? "",
			unitId: initialData?.unit?.id ?? undefined,
		},
	});

	const selectedCompanyId = useWatch({ control, name: "companyId" });
	const selectedUnitId = useWatch({ control, name: "unitId" });
	const zipCode = useWatch({ control, name: "zipCode" });

	const selectedCompany = useMemo(
		() => data?.companies.find((company) => company.id === selectedCompanyId),
		[data?.companies, selectedCompanyId],
	);

	useEffect(() => {
		if (!selectedCompanyId) {
			setValue("unitId", undefined);
			return;
		}

		if (!selectedUnitId) return;

		const hasSelectedUnitInCompany = selectedCompany?.units.some(
			(unit) => unit.id === selectedUnitId,
		);

		if (!hasSelectedUnitInCompany) {
			setValue("unitId", undefined);
		}
	}, [selectedCompany, selectedCompanyId, selectedUnitId, setValue]);

	useEffect(() => {
		const digits = (zipCode ?? "").replace(/\D/g, "");

		if (digits.length !== 8) {
			return;
		}

		const abortController = new AbortController();

		const resolveZipCode = async () => {
			try {
				const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
					signal: abortController.signal,
				});

				if (!response.ok) return;

				const data = (await response.json()) as ViaCepResponse;
				if (data.erro) return;

				setValue("street", data.logradouro ?? "");
				setValue("neighborhood", data.bairro ?? "");
				setValue("city", data.localidade ?? "");
				setValue("state", data.uf ?? "");
				setValue("country", "BR");
				if (data.complemento) {
					setValue("complement", data.complemento);
				}
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") {
					return;
				}
			}
		};

		void resolveZipCode();

		return () => {
			abortController.abort();
		};
	}, [setValue, zipCode]);

	async function onSubmit(formData: EmployeeFormData) {
		const slug = organization!.slug;
		const defaultSuccessMessage =
			mode === "edit" ? "Funcionário atualizado com sucesso." : "Funcionário criado com sucesso.";

		try {
			let savedEmployeeId: string;

			if (mode === "edit" && initialData) {
				await updateEmployee({
					slug,
					employeeId: initialData.id,
					data: formData,
				});
				savedEmployeeId = initialData.id;
			} else {
				const createdEmployee = await createEmployee({
					slug,
					data: formData,
				});
				savedEmployeeId = createdEmployee.employeeId;
			}

			await queryClient.invalidateQueries({
				queryKey: getOrganizationsSlugEmployeesQueryKey({ slug }),
			});

			const employeesResponse = await queryClient.fetchQuery(
				getOrganizationsSlugEmployeesQueryOptions({ slug }),
			);
			const savedEmployee = employeesResponse.employees.find(
				(employee) => employee.id === savedEmployeeId,
			);
			const linkedUser = savedEmployee?.linkedUser;

			if (linkedUser) {
				const linkedUserLabel = linkedUser.name ?? linkedUser.email;
				toast.success(`Funcionário vinculado ao usuário ${linkedUserLabel}.`);
			} else {
				toast.success(defaultSuccessMessage);
			}

			onSuccess?.();
		} catch (error) {
			toast.error(resolveErrorMessage(normalizeApiError(error)));
		}
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
			<section className="space-y-3">
				<h3 className="text-sm font-medium text-muted-foreground">Dados básicos</h3>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					<FieldGroup>
						<Controller
							name="name"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="name">Nome</FieldLabel>
									<Input
										{...field}
										id="name"
										value={field.value ?? ""}
										placeholder="Nome do funcionário"
										onChange={(event) => {
											field.onChange(formatTitleCase(event.target.value));
										}}
									/>
									{fieldState.invalid && (
										<FieldError id="name-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="email"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="email">Email</FieldLabel>
									<Input
										{...field}
										id="email"
										value={field.value ?? ""}
										type="text"
										placeholder="email@empresa.com"
									/>
									{fieldState.invalid && (
										<FieldError id="email-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
				</div>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-4">
					<FieldGroup>
						<Controller
							name="role"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="role">Cargo</FieldLabel>
									<Input
										{...field}
										id="role"
										value={field.value ?? ""}
										placeholder="Ex: Vendedor"
										onChange={(event) => {
											field.onChange(formatTitleCase(event.target.value));
										}}
									/>
									{fieldState.invalid && (
										<FieldError id="role-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="department"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="department">Departamento</FieldLabel>
									<Input
										{...field}
										id="department"
										value={field.value ?? ""}
										placeholder="Ex: Comercial"
										onChange={(event) => {
											field.onChange(formatTitleCase(event.target.value));
										}}
									/>
									{fieldState.invalid && (
										<FieldError
											id="department-error"
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="phone"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="phone">Telefone</FieldLabel>
									<Input
										{...field}
										id="phone"
										value={field.value ?? ""}
										placeholder="(51) 99999-9999"
										onChange={(event) => {
											field.onChange(formatPhone(event.target.value));
										}}
									/>
									{fieldState.invalid && (
										<FieldError id="phone-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="cpf"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="cpf">CPF</FieldLabel>
									<Input
										{...field}
										id="cpf"
										value={field.value ?? ""}
										placeholder="000.000.000-00"
										onChange={(event) => {
											field.onChange(
												formatDocument({
													type: "CPF",
													value: event.target.value,
												}),
											);
										}}
									/>
									{fieldState.invalid && (
										<FieldError id="cpf-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
				</div>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					<FieldGroup>
						<Controller
							name="companyId"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel>Empresa</FieldLabel>
									<Select
										value={field.value ?? ""}
										onValueChange={field.onChange}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione" />
										</SelectTrigger>
										<SelectContent>
											{data?.companies.map((company) => (
												<SelectItem key={company.id} value={company.id}>
													{company.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{fieldState.invalid && (
										<FieldError id="companyId-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="unitId"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel>Unidade</FieldLabel>
									<Select
										value={field.value ?? "__none__"}
										onValueChange={(value) =>
											field.onChange(value === "__none__" ? undefined : value)
										}
										disabled={!selectedCompanyId}
									>
										<SelectTrigger>
											<SelectValue
												placeholder={
													selectedCompanyId
														? "Selecione uma unidade (opcional)"
														: "Selecione uma empresa primeiro"
												}
											/>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__none__">Nenhuma vinculada</SelectItem>
											{selectedCompany?.units.map((unit) => (
												<SelectItem key={unit.id} value={unit.id}>
													{unit.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{fieldState.invalid && (
										<FieldError id="unitId-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
				</div>
			</section>

			<Separator />

			<section className="space-y-3">
				<h3 className="text-sm font-medium text-muted-foreground">Endereço</h3>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					<FieldGroup>
						<Controller
							name="zipCode"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="zipCode">CEP</FieldLabel>
									<Input
										{...field}
										id="zipCode"
										value={field.value ?? ""}
										inputMode="numeric"
										placeholder="Ex: 00000-000"
										onChange={(event) => {
											field.onChange(formatZipCode(event.target.value));
										}}
									/>
									{fieldState.invalid && (
										<FieldError id="zipCode-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="country"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="country">País</FieldLabel>
									<Input
										{...field}
										id="country"
										value={field.value ?? ""}
										placeholder="Ex: BR"
									/>
									{fieldState.invalid && (
										<FieldError id="country-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
				</div>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					<FieldGroup>
						<Controller
							name="state"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="state">Estado</FieldLabel>
									<Input
										{...field}
										id="state"
										value={field.value ?? ""}
										placeholder="Ex: RS"
									/>
									{fieldState.invalid && (
										<FieldError id="state-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="city"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="city">Cidade</FieldLabel>
									<Input
										{...field}
										id="city"
										value={field.value ?? ""}
										placeholder="Ex: Porto Alegre"
									/>
									{fieldState.invalid && (
										<FieldError id="city-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
				</div>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
					<FieldGroup className="md:col-span-2">
						<Controller
							name="street"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="street">Rua</FieldLabel>
									<Input
										{...field}
										id="street"
										value={field.value ?? ""}
										placeholder="Ex: Rua Exemplo"
									/>
									{fieldState.invalid && (
										<FieldError id="street-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="number"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="number">Número</FieldLabel>
									<Input
										{...field}
										id="number"
										value={field.value ?? ""}
										placeholder="Ex: 120"
									/>
									{fieldState.invalid && (
										<FieldError id="number-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
				</div>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					<FieldGroup>
						<Controller
							name="neighborhood"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="neighborhood">Bairro</FieldLabel>
									<Input
										{...field}
										id="neighborhood"
										value={field.value ?? ""}
										placeholder="Ex: Centro"
									/>
									{fieldState.invalid && (
										<FieldError
											id="neighborhood-error"
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="complement"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="complement">Complemento</FieldLabel>
									<Input
										{...field}
										id="complement"
										value={field.value ?? ""}
										placeholder="Ex: Sala 202"
									/>
									{fieldState.invalid && (
										<FieldError
											id="complement-error"
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>
					</FieldGroup>
				</div>
			</section>

			<Separator />

			<section className="space-y-3">
				<h3 className="text-sm font-medium text-muted-foreground">Pagamento</h3>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					<FieldGroup>
						<Controller
							name="pixKeyType"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel>Tipo da chave PIX</FieldLabel>
									<Select
										value={field.value ?? "__none__"}
										onValueChange={(value) =>
											field.onChange(value === "__none__" ? undefined : value)
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione (opcional)" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__none__">Nenhum</SelectItem>
											{PIX_KEY_TYPE_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{fieldState.invalid && (
										<FieldError
											id="pixKeyType-error"
											errors={[fieldState.error]}
										/>
									)}
								</Field>
							)}
						/>
					</FieldGroup>
					<FieldGroup>
						<Controller
							name="pixKey"
							control={control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid} className="gap-1">
									<FieldLabel htmlFor="pixKey">Chave PIX</FieldLabel>
									<Input
										{...field}
										id="pixKey"
										value={field.value ?? ""}
										placeholder="Informe a chave PIX"
									/>
									{fieldState.invalid && (
										<FieldError id="pixKey-error" errors={[fieldState.error]} />
									)}
								</Field>
							)}
						/>
					</FieldGroup>
				</div>
				<FieldGroup>
					<Controller
						name="paymentNotes"
						control={control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid} className="gap-1">
								<FieldLabel htmlFor="paymentNotes">Dados bancários</FieldLabel>
								<Textarea
									{...field}
									id="paymentNotes"
									value={field.value ?? ""}
									placeholder="Ex: Banco, agência, conta ou instruções de pagamento"
								/>
								{fieldState.invalid && (
									<FieldError
										id="paymentNotes-error"
										errors={[fieldState.error]}
									/>
								)}
							</Field>
						)}
					/>
				</FieldGroup>
			</section>

			<div className="hidden justify-end gap-2 md:flex">
				<Button type="submit">Salvar</Button>
			</div>
			<MobileBottomActionBar>
				<Button type="submit" className="w-full">
					Salvar
				</Button>
			</MobileBottomActionBar>
			<div className="h-20 md:hidden" />
		</form>
	);
}
