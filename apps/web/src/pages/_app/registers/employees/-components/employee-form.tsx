import { Button } from "@/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import type z from "zod";
import { formatTitleCase } from "@/utils/format-title-case";
import {
	employeeSchema,
	type EmployeeFormData,
} from "@/schemas/employee-schema";
import type { Employee } from "@/schemas/types/employee";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-context";
import { useQueryClient } from "@tanstack/react-query";
import { getOrganizationsSlugEmployeesQueryKey, useGetOrganizationsSlugCompanies, usePostOrganizationsSlugEmployees, usePutOrganizationsSlugEmployeesEmployeeid } from "@/http/generated";
import { useEffect, useMemo } from "react";

export type CreateEmployeeType = z.infer<typeof employeeSchema>;

interface CreateEmployeeFormProps {
	onSuccess?: () => void;
	mode?: "create" | "edit";
	initialData?: Employee;
}

export function EmployeeForm({
	onSuccess,
	mode,
	initialData,
}: CreateEmployeeFormProps) {
	const { organization } = useApp()
	const queryClient = useQueryClient()

	const { mutateAsync: createEmployee } = usePostOrganizationsSlugEmployees();
	const { mutateAsync: updateEmployee } = usePutOrganizationsSlugEmployeesEmployeeid();

	const { data } = useGetOrganizationsSlugCompanies({ slug: organization!.slug });

	const { handleSubmit, control, setValue } = useForm<CreateEmployeeType>({
		resolver: zodResolver(employeeSchema as any),
		defaultValues: {
			name: initialData?.name ?? "",
			email: initialData?.email ?? "",
			role: initialData?.role ?? "",
			department: initialData?.department ?? "",
			companyId: initialData?.company.id ?? "",
			unitId: initialData?.unit?.id ?? undefined,
		},
	});

	const selectedCompanyId = useWatch({ control, name: "companyId" });
	const selectedUnitId = useWatch({ control, name: "unitId" });

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

	async function onSubmit(data: EmployeeFormData) {
		if (mode === "edit" && initialData) {
			await updateEmployee({
				slug: organization!.slug,
				employeeId: initialData.id,
				data,
			}, {
				onSuccess: async () => {
					await queryClient.invalidateQueries({
						queryKey: getOrganizationsSlugEmployeesQueryKey({
							slug: organization!.slug,
						}),
					})
				},
			});
		} else {
			await createEmployee({
				slug: organization!.slug,
				data
			}, {
				onSuccess: async () => {
					await queryClient.invalidateQueries({
						queryKey: getOrganizationsSlugEmployeesQueryKey({
							slug: organization!.slug,
						}),
					})
				},
			});
		}

		onSuccess?.();
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
			<FieldGroup>
				<Controller
					name="name"
					control={control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid} className="gap-1">
							<FieldLabel htmlFor="name">Nome</FieldLabel>
							<div>
								<Input
									{...field}
									id="name"
									type="text"
									autoCapitalize="none"
									autoCorrect="off"
									aria-invalid={fieldState.invalid}
									aria-describedby={
										fieldState.invalid ? "name-error" : undefined
									}
									placeholder="Nome do funcionário"
									onChange={(event) => {
										const formattedValue = formatTitleCase(event.target.value);
										field.onChange(formattedValue);
									}}
								/>
							</div>
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
							<div>
								<Input
									{...field}
									id="email"
									type="text"
									autoCapitalize="none"
									autoCorrect="off"
									aria-invalid={fieldState.invalid}
									aria-describedby={
										fieldState.invalid ? "email-error" : undefined
									}
									placeholder="email@empresa.com"
								/>
							</div>
							{fieldState.invalid && (
								<FieldError id="email-error" errors={[fieldState.error]} />
							)}
						</Field>
					)}
				/>
			</FieldGroup>
			<div className="flex items-center gap-3">
				<FieldGroup>
					<Controller
						name="role"
						control={control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid} className="gap-1">
								<FieldLabel htmlFor="role">Cargo</FieldLabel>
								<div>
									<Input
										{...field}
										id="role"
										type="text"
										autoCapitalize="none"
										autoCorrect="off"
										aria-invalid={fieldState.invalid}
										aria-describedby={
											fieldState.invalid ? "role-error" : undefined
										}
										placeholder="Ex: Vendedor"
										onChange={(event) => {
											const formattedValue = formatTitleCase(
												event.target.value,
											);
											field.onChange(formattedValue);
										}}
									/>
								</div>
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
								<div>
									<Input
										{...field}
										id="department"
										type="text"
										autoCapitalize="none"
										autoCorrect="off"
										aria-invalid={fieldState.invalid}
										aria-describedby={
											fieldState.invalid ? "department-error" : undefined
										}
										placeholder="Ex: Comercial"
										onChange={(event) => {
											const formattedValue = formatTitleCase(
												event.target.value,
											);
											field.onChange(formattedValue);
										}}
									/>
								</div>
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
			</div>
			<FieldGroup>
				<Controller
					name="companyId"
					control={control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid} className="gap-1">
							<FieldLabel>Empresa</FieldLabel>
							<Select value={field.value ?? ""} onValueChange={field.onChange}>
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
									<SelectItem value="__none__">Nenhum vinculada</SelectItem>
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
			<div className="flex justify-end gap-2">
				<Button type="submit">Salvar</Button>
			</div>
		</form>
	);
}
