import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { CategoryForm } from "./category-form";
import { useState } from "react";

export function CreateCategory() {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<Plus />
					Adicionar Categoria
				</Button>
			</DialogTrigger>
			<DialogContent>
				<CategoryForm onSuccess={() => setOpen(false)} />
			</DialogContent>
		</Dialog>
	);
}
