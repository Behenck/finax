import { Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { ProductListItem } from "@/schemas/types/product";
import { ProductForm } from "./product-form";

interface DuplicateProductProps {
	product: ProductListItem;
}

export function DuplicateProduct({ product }: DuplicateProductProps) {
	const [open, setOpen] = useState(false);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Duplicar produto"
					title="Duplicar produto"
				>
					<Copy className="text-foreground" />
				</Button>
			</SheetTrigger>
			<SheetContent
				side="right"
				className="w-full sm:max-w-5xl overflow-y-auto"
			>
				<div className="px-4 pb-6 sm:px-6">
					<ProductForm
						duplicateFromProductId={product.id}
						duplicateFromProductName={product.name}
						duplicateParentId={product.parentId}
						duplicateSalesTransactionCategoryId={
							product.salesTransactionCategoryId
						}
						duplicateSalesTransactionCostCenterId={
							product.salesTransactionCostCenterId
						}
						onSuccess={() => setOpen(false)}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
