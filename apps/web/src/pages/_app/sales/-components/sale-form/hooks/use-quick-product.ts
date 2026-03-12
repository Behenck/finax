import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { resolveErrorMessage } from "@/errors";
import { normalizeApiError } from "@/errors/api-error";
import {
	type GetOrganizationsSlugProductsQueryResponse,
	getOrganizationsSlugProductsQueryKey,
	postOrganizationsSlugProducts,
} from "@/http/generated";
import type { SaleProductOption } from "@/hooks/sales/use-sale-form-options";
import type { QuickProductData } from "../quick-product-schema";

type ProductTreeNode = {
	id: string;
	children?: ProductTreeNode[];
};

function hasProductId(nodes: ProductTreeNode[], productId: string): boolean {
	for (const node of nodes) {
		if (node.id === productId) {
			return true;
		}

		if (node.children && hasProductId(node.children, productId)) {
			return true;
		}
	}

	return false;
}

interface UseQuickProductParams {
	organizationSlug?: string;
	queryClient: QueryClient;
	setSaleProductId(productId: string): void;
	onQuickProductCreated(): void;
}

export function useQuickProduct({
	organizationSlug,
	queryClient,
	setSaleProductId,
	onQuickProductCreated,
}: UseQuickProductParams) {
	const [quickCreatedProduct, setQuickCreatedProduct] =
		useState<SaleProductOption | null>(null);

	const { mutateAsync: createQuickProduct, isPending: isCreatingQuickProduct } =
		useMutation({
			mutationFn: async (data: QuickProductData) => {
				if (!organizationSlug) {
					throw new Error("Organização não encontrada");
				}

				return postOrganizationsSlugProducts({
					slug: organizationSlug,
					data: {
						name: data.name.trim(),
						description: null,
						parentId: null,
					},
				});
			},
			onSuccess: async (response, submittedData) => {
				if (!organizationSlug) {
					return;
				}

				const productsQueryKey = getOrganizationsSlugProductsQueryKey({
					slug: organizationSlug,
				});
				const productName = submittedData.name.trim();
				const createdProduct: SaleProductOption = {
					id: response.productId,
					name: productName,
					path: [productName],
					label: productName,
				};

				setQuickCreatedProduct(createdProduct);
				setSaleProductId(response.productId);
				onQuickProductCreated();

				await queryClient.invalidateQueries({
					queryKey: productsQueryKey,
				});
				await queryClient.refetchQueries({
					queryKey: productsQueryKey,
				});

				const refreshedProducts =
					queryClient.getQueryData<GetOrganizationsSlugProductsQueryResponse>(
						productsQueryKey,
					)?.products ?? [];
				if (
					hasProductId(
						refreshedProducts as ProductTreeNode[],
						response.productId,
					)
				) {
					setQuickCreatedProduct(null);
				}

				toast.success("Produto cadastrado e selecionado.");
			},
			onError: (error) => {
				const message = resolveErrorMessage(normalizeApiError(error));
				toast.error(message);
			},
		});

	return {
		quickCreatedProduct,
		createQuickProduct,
		isCreatingQuickProduct,
	};
}
