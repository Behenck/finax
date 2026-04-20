import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugProductsId } from "@/http/generated";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import z from "zod";
import { ProductForm } from "./-components/product-form";

const duplicateProductSearchSchema = z.object({
	productId: z.uuid(),
});

export const Route = createFileRoute("/_app/registers/products/duplicate")({
	validateSearch: (search) => duplicateProductSearchSchema.parse(search),
	component: DuplicateProductPage,
});

function DuplicateProductPage() {
	const { productId } = Route.useSearch();
	const { organization } = useApp();

	const { data, isLoading, isError } = useGetOrganizationsSlugProductsId({
		slug: organization!.slug,
		id: productId,
	});

	if (isLoading) {
		return <p>Carregando...</p>;
	}

	if (isError || !data?.product) {
		return (
			<p className="text-destructive">Erro ao carregar produto para duplicação.</p>
		);
	}

	const { product } = data;

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Duplicar Produto"
				description={`Revise os dados copiados de ${product.name} antes de salvar.`}
				actions={
					<Button asChild variant="outline">
						<Link to="/registers/products">
							<ArrowLeft />
							Voltar
						</Link>
					</Button>
				}
			/>

			<ProductForm
				duplicateFromProductId={product.id}
				duplicateFromProductName={product.name}
				duplicateParentId={product.parentId}
				duplicateSalesTransactionCategoryId={
					product.salesTransactionCategoryId
				}
				duplicateSalesTransactionCostCenterId={
					product.salesTransactionCostCenterId
				}
			/>
		</main>
	);
}
