import { Button } from "@/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { companySchema, type CompanyFormData } from "@/schemas/company-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type z from "zod";
import { formatTitleCase } from "@/utils/format-title-case";
import type { Company } from "@/schemas/types/company";
import { getOrganizationsSlugCompaniesQueryKey, usePostOrganizationsSlugCompanies, usePutOrganizationsSlugCompaniesCompanyid } from "@/http/generated";
import { useApp } from "@/context/app-context";
import { useQueryClient } from "@tanstack/react-query";

export type CreateCompanyType = z.infer<typeof companySchema>;

interface CreateCompanyFormProps {
	onSuccess?: () => void;
	mode?: "create" | "edit";
	initialData?: Company;
}

export function CompanyForm({
	onSuccess,
	mode,
	initialData,
}: CreateCompanyFormProps) {
	const { organization } = useApp()
	const queryClient = useQueryClient()

	const { mutateAsync: createCompany } = usePostOrganizationsSlugCompanies();
	const { mutateAsync: updateCompany } = usePutOrganizationsSlugCompaniesCompanyid();

	const { handleSubmit, control } = useForm<CreateCompanyType>({
		resolver: zodResolver(companySchema as any),
		defaultValues: {
			name: initialData?.name ?? "",
		},
	});

	async function onSubmit(data: CompanyFormData) {
		if (mode === "edit" && initialData) {
			await updateCompany({
				slug: organization!.slug,
				companyId: initialData.id,
				data,
			}, {
				onSuccess: async () => {
					await queryClient.invalidateQueries({
						queryKey: getOrganizationsSlugCompaniesQueryKey({
							slug: organization!.slug,
						}),
					})
				},
			});
		} else {
			await createCompany({
				slug: organization!.slug,
				data
			}, {
				onSuccess: async () => {
					await queryClient.invalidateQueries({
						queryKey: getOrganizationsSlugCompaniesQueryKey({
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
									placeholder="Digite o nome da empresa"
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
			<div className="flex justify-end gap-2">
				<Button type="submit">Salvar</Button>
			</div>
		</form>
	);
}
