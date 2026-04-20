import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import z from "zod";
import { ProductForm } from "./-components/product-form";

const createProductSearchSchema = z.object({
	parentId: z.uuid().optional(),
});

export const Route = createFileRoute("/_app/registers/products/create")({
	validateSearch: (search) => createProductSearchSchema.parse(search),
	component: CreateProductPage,
});

function CreateProductPage() {
	const { parentId } = Route.useSearch();
	const isChildProduct = Boolean(parentId);

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title={isChildProduct ? "Adicionar Produto Filho" : "Adicionar Produto"}
				description={
					isChildProduct
						? "Preencha os dados para cadastrar um produto vinculado ao produto pai."
						: "Preencha os dados para cadastrar um novo produto."
				}
				actions={
					<Button asChild variant="outline">
						<Link to="/registers/products">
							<ArrowLeft />
							Voltar
						</Link>
					</Button>
				}
			/>

			<ProductForm fixedParentId={parentId} />
		</main>
	);
}
