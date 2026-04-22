import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingReveal } from "@/components/loading-reveal";
import { ListPageSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";
import { textFilterParser } from "@/hooks/filters/parsers";
import { useGetOrganizationsSlugProducts } from "@/http/generated";
import type { Product } from "@/schemas/types/product";
import { isNotNull } from "@/utils/is-not-null";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useMemo } from "react";
import { useQueryState } from "nuqs";
import { ProductCard } from "./-components/product-card";

export const Route = createFileRoute("/_app/registers/products/")({
	component: Products,
});

export function Products() {
	const { organization } = useApp();
	const [search, setSearch] = useQueryState("q", textFilterParser);

	const { data, isLoading, isError } = useGetOrganizationsSlugProducts(
		{
			slug: organization!.slug,
		},
		{
			query: {
				staleTime: 60_000,
			},
		},
	);

	const safeProducts = (data?.products as Product[]) ?? [];

	const filteredProducts = useMemo(() => {
		if (!search.trim()) return safeProducts;

		const query = search.toLowerCase();

		function filterNode<
			T extends { name: string; description: string | null; children?: T[] },
		>(node: T): T | null {
			const nodeMatch =
				node.name.toLowerCase().includes(query) ||
				node.description?.toLowerCase().includes(query);

			const filteredChildren =
				node.children?.map(filterNode).filter(isNotNull) ?? [];

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

		return safeProducts.map(filterNode).filter(isNotNull);
	}, [safeProducts, search]);

	if (isError) {
		return <p className="text-destructive">Erro ao carregar produtos.</p>;
	}

	return (
		<LoadingReveal
			loading={isLoading}
			skeleton={
				<ListPageSkeleton actionCount={1} filterCount={1} itemCount={5} />
			}
		>
			<main className="w-full space-y-6">
				<PageHeader
					title="Gerenciar Produtos"
					actions={
						<Button asChild>
							<Link to="/registers/products/create">
								<Plus />
								Adicionar Produto
							</Link>
						</Button>
					}
				/>

				<div className="relative">
					<Search className="absolute left-5 top-1/2 size-4 -translate-1/2 text-muted-foreground" />
					<Input
						placeholder="Buscar por nome ou descrição..."
						className="h-10 w-full pl-10 sm:max-w-md"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>

				{safeProducts.length === 0 ? (
					<Card className="flex items-center justify-center gap-2 p-8">
						<span className="text-sm text-muted-foreground">
							Nenhum produto cadastrado
						</span>
						<Link
							to="/registers/products/create"
							className="cursor-pointer text-sm font-medium text-primary hover:underline"
						>
							Criar primeiro produto
						</Link>
					</Card>
				) : (
					<section className="space-y-3">
						{filteredProducts.map((product) => (
							<ProductCard key={product.id} product={product} />
						))}
					</section>
				)}
			</main>
		</LoadingReveal>
	);
}
