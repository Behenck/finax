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
		<Card className="flex flex-col gap-2 p-2 shadow-none border-none bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 items-center gap-2">
				<div
					className="p-2 rounded-xl"
					style={{
						backgroundColor: `${category.color}20`,
						color: category.color,
					}}
				>
					<Icon className="size-4" />
				</div>

				<div className="min-w-0 flex flex-col text-left">
					<span className="truncate font-medium text-sm">{category.name}</span>
					<span className="text-gray-500 text-xs">{category.code}</span>
				</div>
			</div>

			<div className="flex w-full items-center justify-end gap-1 sm:w-auto">
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
