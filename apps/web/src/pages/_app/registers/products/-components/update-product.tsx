import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { ProductListItem } from "@/schemas/types/product";
import { Settings2 } from "lucide-react";
import { useState } from "react";
import { ProductForm } from "./product-form";

interface UpdateProductProps {
	product: ProductListItem;
}

export function UpdateProduct({
	product,
}: UpdateProductProps) {
	const [open, setOpen] = useState(false);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Editar produto">
					<Settings2 className="text-gray-700" />
				</Button>
			</SheetTrigger>
			<SheetContent
				side="right"
				className="w-full sm:max-w-5xl overflow-y-auto"
			>
				<div className="px-4 pb-6 sm:px-6">
					<ProductForm
						mode="edit"
						initialData={product}
						onSuccess={() => setOpen(false)}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
