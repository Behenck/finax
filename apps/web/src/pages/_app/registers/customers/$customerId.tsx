import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
	ArrowLeft,
	FilePenLine,
	Plus,
	TriangleAlert,
	UserRound,
} from "lucide-react";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugCustomersCustomerid } from "@/http/generated";
import { useAbility } from "@/permissions/access";
import { CustomerSalesList } from "./-components/customer-sales-list";

export const Route = createFileRoute("/_app/registers/customers/$customerId")({
	component: CustomerDetailPage,
});

function formatDateTime(value: string | null) {
	if (!value) {
		return "Não informado";
	}

	return format(parseISO(value), "dd/MM/yyyy");
}

function getPersonTypeLabel(value: "PF" | "PJ") {
	return value === "PF" ? "Pessoa Física" : "Pessoa Jurídica";
}

function getDocumentTypeLabel(value: string) {
	switch (value) {
		case "CPF":
			return "CPF";
		case "CNPJ":
			return "CNPJ";
		case "RG":
			return "RG";
		case "IE":
			return "Inscrição Estadual";
		case "PASSPORT":
			return "Passaporte";
		default:
			return "Outro";
	}
}

export function CustomerDetailPage() {
	const { customerId } = Route.useParams();
	const { organization } = useApp();
	const ability = useAbility();
	const canViewCustomer = ability.can("access", "registers.customers.view");
	const canUpdateCustomer = ability.can("access", "registers.customers.update");
	const canUpdateSale = ability.can("access", "sales.update");
	const canCreateSale = ability.can("access", "sales.create");
	const slug = organization?.slug ?? "";
	const { data, isLoading, isError } =
		useGetOrganizationsSlugCustomersCustomerid(
			{ slug, customerId },
			{
				query: {
					enabled: Boolean(slug && customerId),
				},
			},
		);

	if (!canViewCustomer) {
		return (
			<Card className="p-6">
				<span className="text-muted-foreground">
					Você não possui permissão para visualizar este cliente.
				</span>
			</Card>
		);
	}

	if (isLoading) {
		return (
			<DetailPageSkeleton actionCount={2} summaryCount={4} detailCount={2} />
		);
	}

	if (isError || !data?.customer) {
		return (
			<Card className="p-6">
				<span className="text-destructive">
					Não foi possível carregar o cliente.
				</span>
			</Card>
		);
	}

	const { customer } = data;
	const delinquentSalesCount = customer.sales.filter(
		(sale) => sale.delinquencySummary.hasOpen,
	).length;
	const openDelinquenciesCount = customer.sales.reduce(
		(total, sale) => total + sale.delinquencySummary.openCount,
		0,
	);
	const customerDataTabContent = (
		<>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<Card className="p-5 space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">Tipo</span>
						<UserRound className="size-4 text-muted-foreground" />
					</div>
					<p className="text-lg font-semibold">
						{getPersonTypeLabel(customer.personType)}
					</p>
				</Card>
				<Card className="p-5 space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">Status</span>
						<Badge variant="outline">
							{customer.status === "ACTIVE" ? "Ativo" : "Inativo"}
						</Badge>
					</div>
					<p className="text-sm text-muted-foreground">
						{customer.responsible
							? `Responsável: ${customer.responsible.name}`
							: "Sem responsável vinculado"}
					</p>
				</Card>
				<Card className="p-5 space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">Vendas visíveis</span>
						<span className="text-xs text-muted-foreground">Total</span>
					</div>
					<p className="text-lg font-semibold">{customer.sales.length}</p>
				</Card>
				<Card className="p-5 space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">Inadimplência</span>
						<TriangleAlert className="size-4 text-rose-600" />
					</div>
					<p className="text-lg font-semibold">
						{delinquentSalesCount} venda(s)
					</p>
					<p className="text-sm text-muted-foreground">
						{openDelinquenciesCount} ocorrência(s) em aberto
					</p>
				</Card>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card className="p-6 space-y-3">
					<h2 className="font-semibold">Dados do cliente</h2>
					<div className="space-y-2 text-sm">
						<p>
							<strong>Documento:</strong>{" "}
							{getDocumentTypeLabel(customer.documentType)}{" "}
							{customer.documentNumber}
						</p>
						<p>
							<strong>Telefone:</strong> {customer.phone ?? "Não informado"}
						</p>
						<p>
							<strong>E-mail:</strong> {customer.email ?? "Não informado"}
						</p>
						<p>
							<strong>Responsável:</strong>{" "}
							{customer.responsible
								? `${customer.responsible.name} (${customer.responsible.type === "SELLER" ? "Vendedor" : "Parceiro"})`
								: "Não vinculado"}
						</p>
					</div>
				</Card>

				<Card className="p-6 space-y-3">
					<h2 className="font-semibold">Informações complementares</h2>
					<div className="space-y-2 text-sm">
						{customer.pf ? (
							<>
								<p>
									<strong>Data de nascimento:</strong>{" "}
									{formatDateTime(customer.pf.birthDate)}
								</p>
								<p>
									<strong>Profissão:</strong>{" "}
									{customer.pf.profession ?? "Não informado"}
								</p>
								<p>
									<strong>Naturalidade:</strong>{" "}
									{customer.pf.naturality ?? "Não informado"}
								</p>
							</>
						) : null}
						{customer.pj ? (
							<>
								<p>
									<strong>Razão social:</strong>{" "}
									{customer.pj.legalName ?? "Não informado"}
								</p>
								<p>
									<strong>Nome fantasia:</strong>{" "}
									{customer.pj.tradeName ?? "Não informado"}
								</p>
								<p>
									<strong>Fundação:</strong>{" "}
									{formatDateTime(customer.pj.foundationDate)}
								</p>
							</>
						) : null}
						{!customer.pf && !customer.pj ? (
							<p className="text-muted-foreground">
								Nenhuma informação complementar cadastrada.
							</p>
						) : null}
					</div>
				</Card>
			</div>
		</>
	);

	const customerSalesTabContent = (
		<section className="space-y-4">
			<div className="grid gap-3 md:grid-cols-3">
				<Card className="p-5 space-y-1">
					<p className="text-sm text-muted-foreground">Total de vendas</p>
					<p className="text-2xl font-semibold">{customer.sales.length}</p>
				</Card>
				<Card className="p-5 space-y-1">
					<p className="text-sm text-muted-foreground">Vendas inadimplentes</p>
					<p className="text-2xl font-semibold">{delinquentSalesCount}</p>
				</Card>
				<Card className="p-5 space-y-1">
					<p className="text-sm text-muted-foreground">Ocorrências em aberto</p>
					<p className="text-2xl font-semibold">{openDelinquenciesCount}</p>
				</Card>
			</div>

			<div className="space-y-1">
				<h2 className="font-semibold">Vendas do cliente</h2>
				<p className="text-sm text-muted-foreground">
					As vendas com inadimplência aparecem destacadas para facilitar a
					identificação de possível risco de estorno.
				</p>
			</div>
			<CustomerSalesList
				sales={customer.sales}
				customerId={customer.id}
				canManageDelinquencies={canUpdateSale}
			/>
		</section>
	);

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title={customer.name}
				description="Acompanhe os dados do cliente e as vendas vinculadas a ele."
				actions={
					<>
						<Button type="button" variant="outline" asChild>
							<Link to="/registers/customers">
								<ArrowLeft className="size-4" />
								Voltar
							</Link>
						</Button>
						{canUpdateCustomer ? (
							<Button type="button" variant="outline" asChild>
								<Link
									to="/registers/customers/update"
									search={{ customerId: customer.id }}
								>
									<FilePenLine className="size-4" />
									Editar cliente
								</Link>
							</Button>
						) : null}
						{canCreateSale ? (
							<Button type="button" asChild>
								<Link to="/sales/create" search={{ customerId: customer.id }}>
									<Plus className="size-4" />
									Adicionar venda
								</Link>
							</Button>
						) : null}
					</>
				}
			/>

			<Tabs defaultValue="dados" className="space-y-4">
				<TabsList>
					<TabsTrigger value="dados">Dados</TabsTrigger>
					<TabsTrigger value="vendas">Vendas</TabsTrigger>
				</TabsList>

				<TabsContent value="dados" className="space-y-6">
					{customerDataTabContent}
				</TabsContent>
				<TabsContent value="vendas" className="space-y-4">
					{customerSalesTabContent}
				</TabsContent>
			</Tabs>
		</main>
	);
}
