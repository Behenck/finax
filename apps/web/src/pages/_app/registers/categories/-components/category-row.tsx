import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { getLucideIcon } from "@/components/lucide-icon";
import type { Category, CategoryChild } from "@/schemas/types/category";
import { UpdateCategory } from "./update-category";

interface CategoryRowProps {
	category: Category | CategoryChild;
	isLoading?: boolean;
	onDelete(category: Category | CategoryChild): void;
}

export function CategoryRow({
	category,
	onDelete,
	isLoading,
}: CategoryRowProps) {
	const Icon = getLucideIcon(category.icon);

	return (
		<Card className="flex flex-row items-center justify-between gap-2 p-2 shadow-none border-none bg-gray-50">
			<div className="flex items-center gap-2">
				<div
					className="p-2 rounded-xl"
					style={{
						backgroundColor: `${category.color}20`,
						color: category.color,
					}}
				>
					<Icon className="size-4" />
				</div>

				<div className="flex flex-col text-left">
					<span className="font-medium text-sm">{category.name}</span>
					<span className="text-gray-500 text-xs">{category.code}</span>
				</div>
			</div>

			<div className="flex items-center gap-1">
				<UpdateCategory category={category} />

				<Button
					variant="ghost"
					size="icon"
					disabled={isLoading}
					onClick={() => onDelete(category)}
				>
					<Trash2 className="text-red-500" />
				</Button>
			</div>
		</Card>
	);
}
