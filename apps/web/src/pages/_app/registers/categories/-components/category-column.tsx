import type { Category } from "@/schemas/types/category";
import { CategoryCard } from "./category-card";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { CategoryForm } from "./category-form";
import { useState } from "react";

interface CategoryColumnProps {
	title: string;
	categories: Category[];
}

export function CategoryColumn({ title, categories }: CategoryColumnProps) {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const type = title === "Receitas" ? "INCOME" : "OUTCOME";

	return (
		<section className="flex-1 space-y-2">
			<h2 className="text-muted-foreground font-medium">{title}</h2>

			{categories.length === 0 && (
				<Card className="flex justify-center items-center gap-2 p-8">
					<span className="text-muted-foreground text-sm">
						Nenhuma categoria de {title.toLowerCase()}
					</span>
					<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
						<DialogTrigger asChild>
							<span className="text-primary hover:underline text-sm font-medium cursor-pointer">
								Criar primeira categoria
							</span>
						</DialogTrigger>
						<DialogContent>
							<CategoryForm
								mode="create"
								onSuccess={() => setIsCreateOpen(false)}
								type={type}
							/>
						</DialogContent>
					</Dialog>
				</Card>
			)}

			{categories.map((category) => (
				<CategoryCard key={category.id} category={category} />
			))}
		</section>
	);
}
