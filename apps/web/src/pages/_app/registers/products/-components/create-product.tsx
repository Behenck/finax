import { Plus } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ProductForm } from "./product-form";

interface CreateProductProps {
	fixedParentId?: string;
	trigger?: ReactElement;
}

export function CreateProduct({
	fixedParentId,
	trigger,
}: CreateProductProps) {
	const [open, setOpen] = useState(false);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				{trigger ?? (
					<Button>
						<Plus />
						Adicionar Produto
					</Button>
				)}
			</SheetTrigger>
			<SheetContent
				side="right"
				className="w-full sm:max-w-5xl overflow-y-auto"
			>
				<div className="px-4 pb-6 sm:px-6">
					<ProductForm
						fixedParentId={fixedParentId}
						onSuccess={() => setOpen(false)}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
