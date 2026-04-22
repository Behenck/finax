import { createFileRoute, useNavigate } from "@tanstack/react-router";
import z from "zod";
import { Card } from "@/components/ui/card";
import { FormPageSkeleton } from "@/components/loading-skeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugPartnersPartnerid } from "@/http/generated";
import { useAbility } from "@/permissions/access";
import { LinkedSalesList } from "../-components/linked-sales-list";
import { FormPartner } from "./-components/form-partner";

const partnerUpdateTabValues = ["dados", "vendas"] as const;
type PartnerUpdateTab = (typeof partnerUpdateTabValues)[number];

const updatePartnerSearchSchema = z.object({
	partnerId: z.uuid(),
	tab: z.enum(partnerUpdateTabValues).optional(),
});

export const Route = createFileRoute("/_app/registers/partners/update")({
	validateSearch: (search) => updatePartnerSearchSchema.parse(search),
	component: UpdatePartner,
});

function UpdatePartner() {
	const ability = useAbility();
	const navigate = useNavigate();
	const { partnerId, tab } = Route.useSearch();
	const activeTab = tab ?? "dados";
	const { organization } = useApp();
	const canManageDelinquencies = ability.can("access", "sales.update");

	const { data } = useGetOrganizationsSlugPartnersPartnerid({
		slug: organization!.slug,
		partnerId,
	});

	if (!data?.partner) {
		return <FormPageSkeleton showTabs sectionCount={3} />;
	}

	const { partner } = data;
	const delinquentSalesCount = partner.sales.filter(
		(sale) => sale.delinquencySummary.hasOpen,
	).length;
	const openDelinquenciesCount = partner.sales.reduce(
		(total, sale) => total + sale.delinquencySummary.openCount,
		0,
	);

	function handleTabChange(nextTab: string) {
		void navigate({
			to: "/registers/partners/update",
			search: {
				partnerId,
				tab: nextTab as PartnerUpdateTab,
			},
			replace: true,
		});
	}

	return (
		<main className="w-full space-y-6">
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold">Atualizar Parceiro</h1>
					<span className="text-xs text-muted-foreground">
						Preencha os dados para atualizar os dados do parceiro.
					</span>
				</div>
			</header>

			<Tabs
				value={activeTab}
				onValueChange={handleTabChange}
				className="space-y-4"
			>
				<TabsList>
					<TabsTrigger value="dados">Dados</TabsTrigger>
					<TabsTrigger value="vendas">Vendas</TabsTrigger>
				</TabsList>

				<TabsContent value="dados" className="space-y-4">
					<FormPartner type="UPDATE" partner={partner} />
				</TabsContent>

				<TabsContent value="vendas" className="space-y-4">
					<div className="grid gap-3 md:grid-cols-3">
						<Card className="space-y-1 p-5">
							<p className="text-sm text-muted-foreground">Total de vendas</p>
							<p className="text-2xl font-semibold">{partner.sales.length}</p>
						</Card>
						<Card className="space-y-1 p-5">
							<p className="text-sm text-muted-foreground">
								Vendas inadimplentes
							</p>
							<p className="text-2xl font-semibold">{delinquentSalesCount}</p>
						</Card>
						<Card className="space-y-1 p-5">
							<p className="text-sm text-muted-foreground">
								Ocorrências em aberto
							</p>
							<p className="text-2xl font-semibold">{openDelinquenciesCount}</p>
						</Card>
					</div>

					<div className="space-y-1">
						<h2 className="font-semibold">Vendas do parceiro</h2>
						<p className="text-sm text-muted-foreground">
							Vendas em que este parceiro foi o responsável direto aparecem
							aqui, com o cliente e os dados de inadimplência vinculados.
						</p>
					</div>

					<LinkedSalesList
						sales={partner.sales}
						owner={{ type: "PARTNER", id: partner.id }}
						canManageDelinquencies={canManageDelinquencies}
						showCustomer
						emptyMessage="Este parceiro ainda não possui vendas visíveis."
					/>
				</TabsContent>
			</Tabs>
		</main>
	);
}
