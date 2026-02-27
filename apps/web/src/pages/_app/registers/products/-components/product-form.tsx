import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	getOrganizationsSlugProductsQueryKey,
	usePostOrganizationsSlugProducts,
	usePutOrganizationsSlugProductsId,
} from "@/http/generated";
import { type ProductFormData, productSchema } from "@/schemas/product-schema";
import type { ProductListItem } from "@/schemas/types/product";

interface ProductFormProps {
	onSuccess?: () => void;
	mode?: "create" | "edit";
	initialData?: ProductListItem;
	fixedParentId?: string;
}

export function ProductForm({
	onSuccess,
	mode = "create",
	initialData,
	fixedParentId,
}: ProductFormProps) {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	const { mutateAsync: createProduct, isPending: isCreating } =
		usePostOrganizationsSlugProducts();
	const { mutateAsync: updateProduct, isPending: isUpdating } =
		usePutOrganizationsSlugProductsId();

	const isPending = isCreating || isUpdating;
	const isEditMode = mode === "edit" && !!initialData;

	const { handleSubmit, control } = useForm<ProductFormData>({
		resolver: zodResolver(productSchema as any),
		defaultValues: {
			name: initialData?.name ?? "",
			description: initialData?.description ?? "",
		},
	});

	async function invalidateProducts() {
		await queryClient.invalidateQueries({
			queryKey: getOrganizationsSlugProductsQueryKey({
				slug: organization!.slug,
			}),
		});
	}

	async function onSubmit(data: ProductFormData) {
		const name = data.name.trim();
		const description = data.description?.trim()
			? data.description.trim()
			: null;

		try {
			if (isEditMode && initialData) {
				await updateProduct({
					slug: organization!.slug,
					id: initialData.id,
					data: {
						name,
						description,
						parentId: initialData.parentId,
						isActive: initialData.isActive,
						sortOrder: initialData.sortOrder,
					},
				});
				toast.success("Produto atualizado com sucesso");
			} else {
				await createProduct({
					slug: organization!.slug,
					data: {
						name,
						description,
						parentId: fixedParentId ?? null,
					},
				});
				toast.success("Produto cadastrado com sucesso");
			}

			await invalidateProducts();
			onSuccess?.();
		} catch (error) {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		}
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
			<FieldGroup>
				<Controller
					name="name"
					control={control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid} className="gap-1">
							<FieldLabel htmlFor="product-name">Nome</FieldLabel>
							<Input
								{...field}
								id="product-name"
								type="text"
								placeholder="Digite o nome do produto"
								autoCapitalize="none"
								autoCorrect="off"
								aria-invalid={fieldState.invalid}
								aria-describedby={
									fieldState.invalid ? "product-name-error" : undefined
								}
							/>
							{fieldState.invalid && (
								<FieldError
									id="product-name-error"
									errors={[fieldState.error]}
								/>
							)}
						</Field>
					)}
				/>
			</FieldGroup>

			<FieldGroup>
				<Controller
					name="description"
					control={control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid} className="gap-1">
							<FieldLabel htmlFor="product-description">Descrição</FieldLabel>
							<Textarea
								{...field}
								id="product-description"
								value={field.value ?? ""}
								placeholder="Descreva o produto (opcional)"
								className="min-h-24"
								autoCapitalize="none"
								autoCorrect="off"
								aria-invalid={fieldState.invalid}
								aria-describedby={
									fieldState.invalid ? "product-description-error" : undefined
								}
							/>
							{fieldState.invalid && (
								<FieldError
									id="product-description-error"
									errors={[fieldState.error]}
								/>
							)}
						</Field>
					)}
				/>
			</FieldGroup>

			<div className="flex justify-end gap-2">
				<Button type="submit" disabled={isPending}>
					{isPending ? "Salvando..." : "Salvar"}
				</Button>
			</div>
		</form>
	);
}
