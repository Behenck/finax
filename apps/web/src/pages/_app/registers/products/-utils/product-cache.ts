import type { QueryClient } from "@tanstack/react-query";
import { getOrganizationsSlugProductsQueryKey } from "@/http/generated";
import type { Product, ProductListItem } from "@/schemas/types/product";

type ProductsCache = {
	products: Product[];
};

function sortProducts(products: Product[]) {
	return [...products].sort((first, second) => {
		if (first.sortOrder !== second.sortOrder) {
			return first.sortOrder - second.sortOrder;
		}

		return first.name.localeCompare(second.name);
	});
}

function mapProducts(
	products: Product[],
	mapper: (product: Product) => Product,
): Product[] {
	return products.map((product) =>
		mapper({
			...product,
			children: product.children
				? mapProducts(product.children as Product[], mapper)
				: [],
		}),
	);
}

function removeProduct(products: Product[], productId: string): Product[] {
	return products
		.filter((product) => product.id !== productId)
		.map((product) => ({
			...product,
			children: product.children
				? removeProduct(product.children as Product[], productId)
				: [],
		}));
}

function insertProduct(products: Product[], product: Product): Product[] {
	if (!product.parentId) {
		return sortProducts([...products, product]);
	}

	let inserted = false;
	const nextProducts = mapProducts(products, (currentProduct) => {
		if (currentProduct.id !== product.parentId) {
			return currentProduct;
		}

		inserted = true;
		return {
			...currentProduct,
			children: sortProducts([
				...((currentProduct.children as Product[] | undefined) ?? []),
				product,
			]),
		};
	});

	return inserted ? nextProducts : sortProducts([...products, product]);
}

function updateProduct(
	products: Product[],
	product: ProductListItem,
): Product[] {
	return mapProducts(products, (currentProduct) => {
		if (currentProduct.id !== product.id) {
			return currentProduct;
		}

		return {
			...currentProduct,
			...product,
			children: currentProduct.children ?? [],
		};
	});
}

export function addProductToProductsCache(
	queryClient: QueryClient,
	slug: string,
	product: Product,
) {
	queryClient.setQueryData<ProductsCache>(
		getOrganizationsSlugProductsQueryKey({ slug }),
		(currentData) => {
			if (!currentData) {
				return { products: [product] };
			}

			return {
				products: insertProduct(currentData.products, product),
			};
		},
	);
}

export function updateProductInProductsCache(
	queryClient: QueryClient,
	slug: string,
	product: ProductListItem,
) {
	queryClient.setQueryData<ProductsCache>(
		getOrganizationsSlugProductsQueryKey({ slug }),
		(currentData) => {
			if (!currentData) {
				return currentData;
			}

			return {
				products: updateProduct(currentData.products, product),
			};
		},
	);
}

export function removeProductFromProductsCache(
	queryClient: QueryClient,
	slug: string,
	productId: string,
) {
	queryClient.setQueryData<ProductsCache>(
		getOrganizationsSlugProductsQueryKey({ slug }),
		(currentData) => {
			if (!currentData) {
				return currentData;
			}

			return {
				products: removeProduct(currentData.products, productId),
			};
		},
	);
}
