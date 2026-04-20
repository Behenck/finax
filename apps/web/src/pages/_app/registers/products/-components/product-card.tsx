import { useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useApp } from "@/context/app-context";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	useDeleteOrganizationsSlugProductsId,
	usePutOrganizationsSlugProductsId,
} from "@/http/generated";
import { cn } from "@/lib/utils";
import type { Product, ProductListItem } from "@/schemas/types/product";
import {
	getProductsCache,
	removeProductFromProductsCache,
	restoreProductsCache,
	updateProductInProductsCache,
} from "../-utils/product-cache";
import { ProductScenarioBadges } from "./product-scenario-badges";
import { ProductRow } from "./product-row";

interface ProductCardProps {
	product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
	const { organization } = useApp();
	const queryClient = useQueryClient();

	const [isOpen, setIsOpen] = useState(false);
	const { mutateAsync: handleDeleteProduct, isPending: isDeleting } =
		useDeleteOrganizationsSlugProductsId();
	const { mutateAsync: handleUpdateProduct, isPending: isUpdating } =
		usePutOrganizationsSlugProductsId();
	const isPending = isDeleting || isUpdating;

	const children = product.children ?? [];
	const hasChildren = children.length > 0;
	const isInactive = !product.isActive;
	// const mutedIconClass = isInactive ? "text-muted-foreground" : "text-muted-foreground";

	async function onDelete(target: ProductListItem) {
		const confirmed = window.confirm(
			`Deseja realmente excluir o produto ${target.name}?`,
		);
		if (!confirmed) return;

		const slug = organization!.slug;
		const previousProducts = getProductsCache(queryClient, slug);
		removeProductFromProductsCache(queryClient, slug, target.id);

		try {
			await handleDeleteProduct({
				slug,
				id: target.id,
			});

			toast.success(`Produto ${target.name} excluído com sucesso!`);
		} catch (error) {
			if (previousProducts) {
				restoreProductsCache(queryClient, slug, previousProducts);
			}

			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		}
	}

	async function onToggleActive(target: ProductListItem) {
		try {
			await handleUpdateProduct({
				slug: organization!.slug,
				id: target.id,
				data: {
					name: target.name,
					description: target.description,
					parentId: target.parentId,
					isActive: !target.isActive,
					sortOrder: target.sortOrder,
					salesTransactionCategoryId: target.salesTransactionCategoryId,
					salesTransactionCostCenterId: target.salesTransactionCostCenterId,
				},
			});

			updateProductInProductsCache(queryClient, organization!.slug, {
				...target,
				isActive: !target.isActive,
			});
			toast.success(
				`Produto ${target.name} ${target.isActive ? "desativado" : "ativado"} com sucesso!`,
			);
		} catch (error) {
			const message = resolveErrorMessage(normalizeApiError(error));
			toast.error(message);
		}
	}

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<Card
				className={cn(
					"rounded-lg px-6 py-4 transition-opacity",
					!product.isActive && "opacity-60",
				)}
			>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 text-left">
						{hasChildren ? (
							isOpen ? (
								<ChevronUp className="mt-0.5 size-5 shrink-0" />
							) : (
								<ChevronRight className="mt-0.5 size-5 shrink-0" />
							)
						) : (
							<div className="size-5 shrink-0" />
						)}

						<div className="flex min-w-0 items-center gap-3">
							<div
								className={cn(
									"rounded-xl p-2",
									isInactive
										? "bg-muted text-muted-foreground"
										: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
								)}
							>
								<Package className="size-4" />
							</div>

							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-medium">{product.name}</span>
								</div>

								{product.description && (
									<p className="mt-1 truncate text-sm text-muted-foreground">
										{product.description}
									</p>
								)}

								<ProductScenarioBadges
									productId={product.id}
									enabled={isOpen}
								/>

								{hasChildren && (
									<p className="mt-1 text-xs text-muted-foreground">
										{children.length} produto(s) filho(s)
									</p>
								)}
							</div>
						</div>
					</CollapsibleTrigger>

					<div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto">
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
							disabled={isPending}
							aria-label={
								product.isActive ? "Desativar produto" : "Ativar produto"
							}
							title={product.isActive ? "Desativar produto" : "Ativar produto"}
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
							disabled={isPending}
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
								isLoading={isPending}
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
