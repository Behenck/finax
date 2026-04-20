import {
	ChevronRight,
	ChevronUp,
	CirclePlus,
	Copy,
	Package,
	Power,
	Settings2,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ProductChild, ProductListItem } from "@/schemas/types/product";
import { ProductScenarioBadges } from "./product-scenario-badges";

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
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
									? "bg-muted text-muted-foreground"
									: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
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

							<ProductScenarioBadges productId={product.id} enabled={isOpen} />

							{hasChildren && (
								<p className="mt-1 text-xs text-muted-foreground">
									{children.length} produto(s) filho(s)
								</p>
							)}
						</div>
					</CollapsibleTrigger>

					<div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto">
						{isLoading ? (
							<Button
								variant="ghost"
								size="icon"
								disabled
								aria-label="Adicionar produto filho"
								title="Adicionar produto filho"
							>
								<CirclePlus className="text-foreground" />
							</Button>
						) : (
							<Button
								asChild
								variant="ghost"
								size="icon"
								aria-label="Adicionar produto filho"
								title="Adicionar produto filho"
							>
								<Link
									to="/registers/products/create"
									search={{ parentId: product.id }}
								>
									<CirclePlus className="text-foreground" />
								</Link>
							</Button>
						)}

						<Button
							asChild
							variant="ghost"
							size="icon"
							aria-label="Editar produto"
							title="Editar produto"
						>
							<Link
								to="/registers/products/update"
								search={{ productId: product.id }}
							>
								<Settings2 className="text-foreground" />
							</Link>
						</Button>

						<Button
							asChild
							variant="ghost"
							size="icon"
							aria-label="Duplicar produto"
							title="Duplicar produto"
						>
							<Link
								to="/registers/products/duplicate"
								search={{ productId: product.id }}
							>
								<Copy className="text-foreground" />
							</Link>
						</Button>

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
								className={cn(
									"text-green-600",
									isInactive && "text-muted-foreground",
								)}
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
