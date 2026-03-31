import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { useApp } from "@/context/app-context";
import { useCreateSalesBatch, useSaleFormOptions } from "@/hooks/sales";
import { getOrganizationsSlugProductsIdSaleFields } from "@/http/generated";
import { useAbility } from "@/permissions/access";
import type { SaleDynamicFieldSchemaItem } from "@/schemas/types/sale-dynamic-fields";
import { QuickSaleForm } from "./-components/quick-sale-form";

export const Route = createFileRoute("/_app/sales/quick-create")({
	component: QuickCreateSalesPage,
});

function QuickCreateSalesPage() {
	const ability = useAbility();
	const canCreateSale = ability.can("access", "sales.create");
	const navigate = useNavigate();
	const { organization } = useApp();
	const {
		companies,
		customers,
		rootProducts,
		hierarchicalProducts,
		sellers,
		partners,
		isLoading: isLoadingOptions,
		isError: isOptionsError,
		refetch,
	} = useSaleFormOptions();
	const { mutateAsync: createSalesBatch, isPending: isCreatingSalesBatch } =
		useCreateSalesBatch();

	async function loadProductDynamicFields(productId: string) {
		if (!organization?.slug || !productId) {
			return [];
		}

		const response = await getOrganizationsSlugProductsIdSaleFields({
			slug: organization.slug,
			id: productId,
			params: {
				includeInherited: true,
			},
		});

		return response.fields.map(
			(field): SaleDynamicFieldSchemaItem => ({
				fieldId: field.id,
				label: field.label,
				type: field.type as SaleDynamicFieldSchemaItem["type"],
				required: field.required,
				options: field.options.map((option) => ({
					id: option.id,
					label: option.label,
					isDefault: option.isDefault,
				})),
			}),
		);
	}

	if (!canCreateSale) {
		return (
			<Card className="p-6">
				<span className="text-muted-foreground">
					Você não possui permissão para cadastrar vendas.
				</span>
			</Card>
		);
	}

	if (isLoadingOptions) {
		return (
			<main className="w-full space-y-6">
				<span className="text-muted-foreground">Carregando opções do formulário...</span>
			</main>
		);
	}

	if (isOptionsError) {
		return (
			<main className="w-full space-y-6">
				<Card className="p-6">
					<div className="space-y-3">
						<p className="text-destructive">
							Não foi possível carregar os dados do formulário rápido.
						</p>
						<Button type="button" variant="outline" onClick={() => refetch()}>
							Tentar novamente
						</Button>
					</div>
				</Card>
			</main>
		);
	}

	if (rootProducts.length === 0) {
		return (
			<main className="w-full space-y-6">
				<PageHeader
					title="Cadastro Rápido de Vendas"
					description="Crie várias vendas de forma transacional no mesmo formulário."
				/>

				<Card className="p-6">
					<p className="text-muted-foreground">
						Cadastre pelo menos um produto pai ativo para usar o cadastro rápido.
					</p>
				</Card>
			</main>
		);
	}

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Cadastro Rápido de Vendas"
				description="Defina os dados base e adicione até 20 itens. O salvamento é transacional: tudo ou nada."
			/>

			<QuickSaleForm
				rootProducts={rootProducts}
				hierarchicalProducts={hierarchicalProducts}
				customers={customers.map((customer) => ({
					id: customer.id,
					name: customer.name,
					documentType: customer.documentType,
					documentNumber: customer.documentNumber,
					phone: customer.phone,
				}))}
				companies={companies.map((company) => ({
					id: company.id,
					name: company.name,
					units: company.units.map((unit) => ({
						id: unit.id,
						name: unit.name,
					})),
				}))}
				sellers={sellers.map((seller) => ({
					id: seller.id,
					name: seller.name,
				}))}
				partners={partners.map((partner) => ({
					id: partner.id,
					name: partner.name,
				}))}
				loadProductDynamicFields={loadProductDynamicFields}
				onSubmitBatch={async (payload) => {
					await createSalesBatch(payload);
				}}
				onRefreshCustomers={refetch}
				onSuccess={() => navigate({ to: "/sales" })}
				isSubmitting={isCreatingSalesBatch}
			/>
		</main>
	);
}
