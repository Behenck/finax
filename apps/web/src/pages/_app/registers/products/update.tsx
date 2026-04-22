import { FormPageSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugProductsId } from "@/http/generated";
import type { ProductListItem } from "@/schemas/types/product";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import z from "zod";
import { ProductForm } from "./-components/product-form";

const updateProductSearchSchema = z.object({
	productId: z.uuid(),
});

export const Route = createFileRoute("/_app/registers/products/update")({
	validateSearch: (search) => updateProductSearchSchema.parse(search),
	component: UpdateProductPage,
});

function UpdateProductPage() {
	const { productId } = Route.useSearch();
	const { organization } = useApp();

	const { data, isLoading, isError } = useGetOrganizationsSlugProductsId({
		slug: organization!.slug,
		id: productId,
	});

	if (isLoading) {
		return <FormPageSkeleton actionCount={1} sectionCount={4} />;
	}

	if (isError || !data?.product) {
		return (
			<p className="text-destructive">Erro ao carregar produto para edição.</p>
		);
	}

	const product: ProductListItem = {
		id: data.product.id,
		name: data.product.name,
		description: data.product.description,
		parentId: data.product.parentId,
		isActive: data.product.isActive,
		sortOrder: data.product.sortOrder,
		salesTransactionCategoryId: data.product.salesTransactionCategoryId,
		salesTransactionCostCenterId: data.product.salesTransactionCostCenterId,
	};

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Editar Produto"
				description="Atualize os dados e configurações do produto."
				actions={
					<Button asChild variant="outline">
						<Link to="/registers/products">
							<ArrowLeft />
							Voltar
						</Link>
					</Button>
				}
			/>

			<ProductForm mode="edit" initialData={product} />
		</main>
	);
}
