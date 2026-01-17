import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { PencilLine } from "lucide-react";
import { CategoryForm } from "./category-form";
import { useState } from "react";
import type { Category, CategoryChild } from "@/schemas/types/category";

interface UpdateCategoryProps {
	category: Category | CategoryChild;
}

export function UpdateCategory({ category }: UpdateCategoryProps) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon">
					<PencilLine />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<CategoryForm
					mode="edit"
					onSuccess={() => setOpen(false)}
					initialData={category}
					parentId={category.parentId ?? undefined}
				/>
			</DialogContent>
		</Dialog>
	);
}
