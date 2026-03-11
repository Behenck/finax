import { Controller, type Control } from "react-hook-form";
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
}

export function ProductSection({
	control,
	products,
	isLoadingOptions,
}: ProductSectionProps) {
	return (
		<Card className="rounded-sm gap-4 p-5">
			<h2 className="font-semibold text-md">Produto</h2>

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
