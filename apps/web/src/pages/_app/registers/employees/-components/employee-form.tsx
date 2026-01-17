import { Button } from "@/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type z from "zod";
import { formatTitleCase } from "@/utils/format-title-case";
import { useCreateEmployee } from "@/hooks/employees/use-create-employee";
import { useUpdateEmployee } from "@/hooks/employees/use-update-employee";
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
import { useCompanies } from "@/hooks/companies/use-companies";

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
	const { mutateAsync: createEmployee } = useCreateEmployee();
	const { mutateAsync: updateEmployee } = useUpdateEmployee();

	const { data: companies } = useCompanies();

	const { handleSubmit, control } = useForm<CreateEmployeeType>({
		resolver: zodResolver(employeeSchema as any),
		defaultValues: {
			name: initialData?.name ?? "",
			email: initialData?.email ?? "",
			role: initialData?.role ?? "",
			department: initialData?.department ?? "",
			companyId: initialData?.company.id ?? "",
		},
	});

	async function onSubmit(data: EmployeeFormData) {
		if (mode === "edit" && initialData) {
			await updateEmployee({
				employeeId: initialData.id,
				data,
			});
		} else {
			await createEmployee(data);
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
									{companies?.map((company) => (
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
			<div className="flex justify-end gap-2">
				<Button type="submit">Salvar</Button>
			</div>
		</form>
	);
}
