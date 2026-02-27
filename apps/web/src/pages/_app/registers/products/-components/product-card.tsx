import { useQueryClient } from "@tanstack/react-query";
import {
	ChevronRight,
	ChevronUp,
	CirclePlus,
	Package,
	Power,
	Trash2,
} from "lucide-react";
import { useState } from "react";
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
	getOrganizationsSlugProductsQueryKey,
	useDeleteOrganizationsSlugProductsId,
	usePutOrganizationsSlugProductsId,
} from "@/http/generated";
import { cn } from "@/lib/utils";
import type { Product, ProductListItem } from "@/schemas/types/product";
import { CreateProduct } from "./create-product";
import { ProductRow } from "./product-row";
import { UpdateProduct } from "./update-product";

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
	// const mutedIconClass = isInactive ? "text-gray-400" : "text-muted-foreground";

	async function invalidateProducts() {
		await queryClient.invalidateQueries({
			queryKey: getOrganizationsSlugProductsQueryKey({
				slug: organization!.slug,
			}),
		});
	}

	async function onDelete(target: ProductListItem) {
		const confirmed = window.confirm(
			`Deseja realmente excluir o produto ${target.name}?`,
		);
		if (!confirmed) return;

		try {
			await handleDeleteProduct({
				slug: organization!.slug,
				id: target.id,
			});

			await invalidateProducts();
			toast.success(`Produto ${target.name} excluído com sucesso!`);
		} catch (error) {
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
				},
			});

			await invalidateProducts();
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
				<div className="flex items-center justify-between gap-4">
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
										? "bg-gray-100 text-gray-400"
										: "bg-blue-100 text-blue-600",
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

								{hasChildren && (
									<p className="mt-1 text-xs text-muted-foreground">
										{children.length} produto(s) filho(s)
									</p>
								)}
							</div>
						</div>
					</CollapsibleTrigger>

					<div className="flex shrink-0 items-center gap-1">
						<CreateProduct
							products={[]}
							fixedParentId={product.id}
							trigger={
								<Button variant="ghost" size="icon">
									<CirclePlus className="text-gray-700" />
								</Button>
							}
						/>

						<UpdateProduct product={product} />

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
								className={cn("text-green-600", isInactive && "text-gray-400")}
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
