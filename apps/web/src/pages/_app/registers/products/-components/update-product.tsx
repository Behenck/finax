import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
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
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Editar produto">
					<Settings2 className="text-gray-700" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<ProductForm mode="edit" initialData={product} onSuccess={() => setOpen(false)} />
			</DialogContent>
		</Dialog>
	);
}
