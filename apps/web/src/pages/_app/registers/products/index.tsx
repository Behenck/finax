import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugProducts } from "@/http/generated";
import type { Product } from "@/schemas/types/product";
import { isNotNull } from "@/utils/is-not-null";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CreateProduct } from "./-components/create-product";
import { ProductCard } from "./-components/product-card";

export const Route = createFileRoute("/_app/registers/products/")({
	component: Products,
});

function Products() {
	const { organization } = useApp();
	const [search, setSearch] = useState("");

	const { data, isLoading, isError } = useGetOrganizationsSlugProducts({
		slug: organization!.slug,
	});

	const safeProducts = (data?.products as Product[]) ?? [];

	const filteredProducts = useMemo(() => {
		if (!search.trim()) return safeProducts;

		const query = search.toLowerCase();

		function filterNode<T extends { name: string; description: string | null; children?: T[] }>(
			node: T,
		): T | null {
			const nodeMatch =
				node.name.toLowerCase().includes(query) ||
				node.description?.toLowerCase().includes(query);

			const filteredChildren = node.children?.map(filterNode).filter(isNotNull) ?? [];

			if (nodeMatch) {
				return node;
			}

			if (filteredChildren.length > 0) {
				return {
					...node,
					children: filteredChildren,
				};
			}

			return null;
		}

		return safeProducts
			.map(filterNode)
			.filter(isNotNull);
	}, [safeProducts, search]);

	if (isLoading) return <p>Carregando...</p>;

	if (isError) {
		return <p className="text-destructive">Erro ao carregar produtos.</p>;
	}

	return (
		<main className="w-full space-y-6">
			<header className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Gerenciar Produtos</h1>

				<CreateProduct />
			</header>

			<div className="relative">
				<Search className="absolute left-5 top-1/2 size-4 -translate-1/2 text-gray-500" />
				<Input
					placeholder="Buscar por nome ou descrição..."
					className="h-10 max-w-[40%] pl-10"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>

			{safeProducts.length === 0 ? (
				<Card className="flex items-center justify-center gap-2 p-8">
					<span className="text-sm text-gray-500">
						Nenhum produto cadastrado
					</span>
					<CreateProduct
						trigger={
							<button
								type="button"
								className="cursor-pointer text-sm font-medium text-primary hover:underline"
							>
								Criar primeiro produto
							</button>
						}
					/>
				</Card>
			) : (
				<section className="space-y-3">
					{filteredProducts.map((product) => (
						<ProductCard key={product.id} product={product} />
					))}
				</section>
			)}
		</main>
	);
}
