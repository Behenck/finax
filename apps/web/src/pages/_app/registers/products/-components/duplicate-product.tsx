import { Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { ProductListItem } from "@/schemas/types/product";
import { ProductForm } from "./product-form";

interface DuplicateProductProps {
	product: ProductListItem;
}

export function DuplicateProduct({ product }: DuplicateProductProps) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Duplicar produto"
					title="Duplicar produto"
				>
					<Copy className="text-gray-700" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-4xl">
				<ProductForm
					duplicateFromProductId={product.id}
					duplicateFromProductName={product.name}
					duplicateParentId={product.parentId}
					onSuccess={() => setOpen(false)}
				/>
			</DialogContent>
		</Dialog>
	);
}
