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
import type { Unit } from "@/schemas/types/unit";
import { unitSchema, type UnitFormData } from "@/schemas/unity-schema";
import { useCreateUnit } from "@/hooks/units/use-create-unit";
import { useUpdateUnit } from "@/hooks/units/use-update-unit";

export type CreateUnitType = z.infer<typeof unitSchema>;

interface CreateUnitFormProps {
	onSuccess?: () => void;
	mode?: "create" | "edit";
	companyId: string;
	initialData?: Unit;
}

export function UnitForm({
	onSuccess,
	mode,
	companyId,
	initialData,
}: CreateUnitFormProps) {
	const { mutateAsync: createUnit } = useCreateUnit();
	const { mutateAsync: updateUnit } = useUpdateUnit();

	const { handleSubmit, control } = useForm<CreateUnitType>({
		resolver: zodResolver(unitSchema as any),
		defaultValues: {
			name: initialData?.name ?? "",
		},
	});

	async function onSubmit(data: UnitFormData) {
		if (mode === "edit" && initialData) {
			await updateUnit({
				companyId,
				unitId: initialData.id,
				data,
			});
		} else {
			await createUnit({ companyId, data });
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
									placeholder="Digite o nome da unidade"
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
