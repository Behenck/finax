import { Plus } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { ProductListItem } from "@/schemas/types/product";
import { ProductForm } from "./product-form";

interface CreateProductProps {
	fixedParentId?: string;
	trigger?: ReactElement;
	products?: ProductListItem[];
}

export function CreateProduct({
	products: _products,
	fixedParentId,
	trigger,
}: CreateProductProps) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger ?? (
					<Button>
						<Plus />
						Adicionar Produto
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<ProductForm
					fixedParentId={fixedParentId}
					onSuccess={() => setOpen(false)}
				/>
			</DialogContent>
		</Dialog>
	);
}
