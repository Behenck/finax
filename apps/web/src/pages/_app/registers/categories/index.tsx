import { createFileRoute } from "@tanstack/react-router";
import { CreateCategory } from "./-components/create-category";
import { useMemo } from "react";
import { CategoryColumn } from "./-components/category-column";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { isNotNull } from "@/utils/is-not-null";
import { Search } from "lucide-react";
import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugCategories } from "@/http/generated";
import { textFilterParser } from "@/hooks/filters/parsers";
import { useQueryState } from "nuqs";

export const Route = createFileRoute("/_app/registers/categories/")({
	component: Categories,
});

function Categories() {
	const { organization } = useApp()

	const { data, isError, isLoading } = useGetOrganizationsSlugCategories({ slug: organization!.slug });
	const [search, setSearch] = useQueryState("q", textFilterParser);

	const safeCategories = data?.categories ?? [];

	const filteredCategories = useMemo(() => {
		if (!search.trim()) return safeCategories;

		const query = search.toLowerCase();

		return safeCategories
			.map((category) => {
				const categoryMatch =
					category.name.toLowerCase().includes(query) ||
					category.code?.toLowerCase().includes(query);

				const filteredChildren =
					category.children?.filter(
						(child) =>
							child.name.toLowerCase().includes(query) ||
							child.code?.toLowerCase().includes(query),
					) ?? [];

				if (categoryMatch) {
					return category;
				}

				if (filteredChildren.length > 0) {
					return {
						...category,
						children: filteredChildren,
					};
				}

				return null;
			})
			.filter(isNotNull);
	}, [safeCategories, search]);

	const { income, outcome } = useMemo(() => {
		return {
			income: filteredCategories.filter(
				(category) => category?.type === "INCOME",
			),
			outcome: filteredCategories.filter(
				(category) => category?.type === "OUTCOME",
			),
		};
	}, [filteredCategories]);

	if (isLoading) return <h1>Carregando...</h1>;

	if (isError) {
		return <p className="text-destructive">Erro ao carregar categorias.</p>;
	}

	return (
		<main className="w-full space-y-6">
			<PageHeader title="Gerenciar Categorias" actions={<CreateCategory />} />

			<div className="relative">
				<Search className="absolute left-5 top-1/2 -translate-1/2 size-4 text-muted-foreground" />
				<Input
					placeholder="Buscar por nome ou código..."
					className="h-10 w-full pl-10 sm:max-w-md"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>

			<section className="grid gap-6 lg:grid-cols-2">
				<CategoryColumn title="Despesas" categories={outcome} />
				<CategoryColumn title="Receitas" categories={income} />
			</section>
		</main>
	);
}
