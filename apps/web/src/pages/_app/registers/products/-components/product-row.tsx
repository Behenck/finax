import {
	ChevronRight,
	ChevronUp,
	CirclePlus,
	Package,
	Power,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ProductChild, ProductListItem } from "@/schemas/types/product";
import { CreateProduct } from "./create-product";
import { DuplicateProduct } from "./duplicate-product";
import { ProductScenarioBadges } from "./product-scenario-badges";
import { UpdateProduct } from "./update-product";

interface ProductRowProps {
	product: ProductChild;
	parentIsActive?: boolean;
	isLoading?: boolean;
	onDelete(product: ProductListItem): void | Promise<void>;
	onToggleActive(product: ProductListItem): void | Promise<void>;
}

export function ProductRow({
	product,
	parentIsActive = true,
	onDelete,
	onToggleActive,
	isLoading,
}: ProductRowProps) {
	const [isOpen, setIsOpen] = useState(false);
	const isInactive = !product.isActive;
	const children = product.children ?? [];
	const hasChildren = children.length > 0;
	const isBlockedByInactiveParent = !product.isActive && !parentIsActive;

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<Card
				className={cn(
					"p-3 transition-opacity",
					!product.isActive && "opacity-60",
				)}
			>
				<div className="flex items-center justify-between gap-3">
					<CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
						{hasChildren ? (
							isOpen ? (
								<ChevronUp className="mt-0.5 size-4 shrink-0" />
							) : (
								<ChevronRight className="mt-0.5 size-4 shrink-0" />
							)
						) : (
							<div className="size-4 shrink-0" />
						)}

						<div
							className={cn(
								"rounded-md p-2",
								isInactive
									? "bg-gray-100 text-gray-400"
									: "bg-blue-100 text-blue-600",
							)}
						>
							<Package className="size-4" />
						</div>

						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<span className="font-medium text-sm">{product.name}</span>
							</div>

								{product.description && (
									<p className="mt-1 truncate text-xs text-muted-foreground">
										{product.description}
									</p>
								)}

								<ProductScenarioBadges productId={product.id} />

								{hasChildren && (
									<p className="mt-1 text-xs text-muted-foreground">
										{children.length} produto(s) filho(s)
									</p>
								)}
						</div>
					</CollapsibleTrigger>

					<div className="flex items-center gap-1">
						<CreateProduct
							fixedParentId={product.id}
							trigger={
								<Button
									variant="ghost"
									size="icon"
									disabled={isLoading}
									aria-label="Adicionar produto filho"
									title="Adicionar produto filho"
								>
									<CirclePlus className="text-gray-700" />
								</Button>
							}
						/>

						<UpdateProduct product={product} />
						<DuplicateProduct product={product} />

						<Button
							variant="ghost"
							size="icon"
							disabled={isLoading || isBlockedByInactiveParent}
							aria-label={
								product.isActive ? "Desativar produto" : "Ativar produto"
							}
							title={
								isBlockedByInactiveParent
									? "Ative o produto pai antes de ativar este filho"
									: product.isActive
										? "Desativar produto"
										: "Ativar produto"
							}
							onClick={() => onToggleActive(product)}
						>
							<Power
								className={cn("text-green-600", isInactive && "text-gray-400")}
							/>
						</Button>

						<Button
							variant="ghost"
							size="icon"
							disabled={isLoading}
							onClick={() => onDelete(product)}
						>
							<Trash2 className="text-red-400" />
						</Button>
					</div>
				</div>
			</Card>

			{hasChildren && (
				<CollapsibleContent className="mt-1 space-y-1">
					{children.map((child) => (
						<div key={child.id} className="ml-8">
							<ProductRow
								product={child}
								parentIsActive={product.isActive}
								isLoading={isLoading}
								onDelete={onDelete}
								onToggleActive={onToggleActive}
							/>
						</div>
					))}
				</CollapsibleContent>
			)}
		</Collapsible>
	);
}
