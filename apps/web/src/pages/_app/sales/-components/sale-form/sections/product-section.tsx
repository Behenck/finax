import { Controller, type Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { FieldError } from "@/components/field-error";
import type { SaleFormData, SaleFormInput } from "@/schemas/sale-schema";

interface ProductSectionProps {
	control: Control<SaleFormInput, unknown, SaleFormData>;
	products: Array<{ id: string; label: string }>;
	isLoadingOptions: boolean;
	isCreatingQuickProduct: boolean;
	onOpenQuickProductDialog(): void;
}

export function ProductSection({
	control,
	products,
	isLoadingOptions,
	isCreatingQuickProduct,
	onOpenQuickProductDialog,
}: ProductSectionProps) {
	return (
		<Card className="rounded-sm gap-4 p-5">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div className="space-y-1">
					<h2 className="font-semibold text-md">Produto</h2>
					<p className="text-muted-foreground text-sm">
						Selecione um produto existente ou faça um cadastro rápido.
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					onClick={onOpenQuickProductDialog}
					disabled={isCreatingQuickProduct}
				>
					Cadastrar produto rápido
				</Button>
			</div>

			<FieldGroup>
				<Field className="gap-1">
					<FieldLabel>Produto *</FieldLabel>
					<Controller
						control={control}
						name="productId"
						render={({ field, fieldState }) => (
							<>
								<Select
									value={field.value || undefined}
									onValueChange={(value) => field.onChange(value)}
									disabled={isLoadingOptions}
								>
									<SelectTrigger>
										<SelectValue placeholder="Selecione um produto" />
									</SelectTrigger>
									<SelectContent>
										{products.map((product) => (
											<SelectItem key={product.id} value={product.id}>
												{product.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FieldError error={fieldState.error} />
							</>
						)}
					/>
				</Field>
			</FieldGroup>
		</Card>
	);
}
