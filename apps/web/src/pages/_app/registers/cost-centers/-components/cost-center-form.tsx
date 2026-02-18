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
import {
	costCenterSchema,
	type CostCenterFormData,
} from "@/schemas/cost-center-schema";
import type { CostCenter } from "@/schemas/types/cost-center";
import { useApp } from "@/context/app-context";
import { getOrganizationsSlugCostcentersQueryKey, usePostOrganizationsSlugCostcenters, usePutOrganizationsSlugCostcentersCostcenterid } from "@/http/generated";
import { useQueryClient } from "@tanstack/react-query";

export type CreateCostCenterType = z.infer<typeof costCenterSchema>;

interface CreateCostCenterFormProps {
	onSuccess?: () => void;
	mode?: "create" | "edit";
	initialData?: CostCenter;
}

export function CostCenterForm({
	onSuccess,
	mode,
	initialData,
}: CreateCostCenterFormProps) {
	const { organization } = useApp()
	const queryClient = useQueryClient()

	const { mutateAsync: createCostCenter } = usePostOrganizationsSlugCostcenters();
	const { mutateAsync: updateCostCenter } = usePutOrganizationsSlugCostcentersCostcenterid();

	const { handleSubmit, control } = useForm<CreateCostCenterType>({
		resolver: zodResolver(costCenterSchema as any),
		defaultValues: {
			name: initialData?.name ?? "",
		},
	});

	async function onSubmit(data: CostCenterFormData) {
		if (mode === "edit" && initialData) {
			await updateCostCenter({
				slug: organization!.slug,
				costCenterId: initialData.id,
				data,
			}, {
				onSuccess: async () => {
					await queryClient.invalidateQueries({
						queryKey: getOrganizationsSlugCostcentersQueryKey({
							slug: organization!.slug,
						}),
					})
				},
			});
		} else {
			await createCostCenter({
				slug: organization!.slug,
				data,
			}, {
				onSuccess: async () => {
					await queryClient.invalidateQueries({
						queryKey: getOrganizationsSlugCostcentersQueryKey({
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
									placeholder="Digite o nome do centro de custo"
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
