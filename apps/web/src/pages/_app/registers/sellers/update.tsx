import { createFileRoute } from "@tanstack/react-router";
import { FormSeller } from "./-components/form-seller";
import z from "zod";
import { FormPageSkeleton } from "@/components/loading-skeletons";
import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugSellersSellerid } from "@/http/generated";

const updateSellerSearchSchema = z.object({
	sellerId: z.uuid(),
});

export const Route = createFileRoute("/_app/registers/sellers/update")({
	validateSearch: (search) => updateSellerSearchSchema.parse(search),
	component: UpdateSeller,
});

function UpdateSeller() {
	const { sellerId } = Route.useSearch();
	const { organization } = useApp();

	const { data } = useGetOrganizationsSlugSellersSellerid({
		slug: organization!.slug,
		sellerId,
	});

	if (!data?.seller) {
		return <FormPageSkeleton sectionCount={2} />;
	}

	return (
		<main className="w-full space-y-6">
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold">Atualizar Vendedor</h1>
					<span className="text-xs text-muted-foreground">
						Preencha os dados para atualizar os dados do vendedor.
					</span>
				</div>
			</header>

			<FormSeller type="UPDATE" seller={data.seller} />
		</main>
	);
}
