import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { Search } from "lucide-react";
import { useMemo } from "react";
import { CompanyCard } from "./-components/company-card";
import { CreateCompany } from "./-components/create-company";
import { createFileRoute } from "@tanstack/react-router";
import { useGetOrganizationsSlugCompanies } from "@/http/generated";
import { useApp } from "@/context/app-context";
import { textFilterParser } from "@/hooks/filters/parsers";
import { useQueryState } from "nuqs";

export const Route = createFileRoute("/_app/registers/companies/")({
	component: Companies,
});

function Companies() {
	const [search, setSearch] = useQueryState("q", textFilterParser);
	const { organization } = useApp()
	const { data, isLoading, isError } = useGetOrganizationsSlugCompanies({ slug: organization!.slug });

	const filteredCompanies = useMemo(() => {
		const safeCompanies = data?.companies ?? [];
		const normalizedSearch = search.trim().toLowerCase();
		const digitsSearch = search.replace(/\D/g, "");

		if (!normalizedSearch) return safeCompanies;

		return safeCompanies.filter((company) => {
			const companyCnpj = company.cnpj ?? "";
			const companyCnpjDigits = companyCnpj.replace(/\D/g, "");
			const companyMatch =
				company.name.toLowerCase().includes(normalizedSearch) ||
				companyCnpj.includes(normalizedSearch) ||
				(digitsSearch ? companyCnpjDigits.includes(digitsSearch) : false);

			const unitMatch = company.units?.some((unit) =>
				unit.name.toLowerCase().includes(normalizedSearch) ||
				(unit.cnpj ?? "").includes(normalizedSearch) ||
				(digitsSearch
					? (unit.cnpj ?? "").replace(/\D/g, "").includes(digitsSearch)
					: false),
			);

			return companyMatch || unitMatch;
		});
	}, [data?.companies, search]);

	if (isLoading) return <h1>Carregando...</h1>;

	if (isError) {
		return <p className="text-destructive">Erro ao carregar empresas.</p>;
	}

	return (
		<main className="w-full space-y-6">
			<PageHeader title="Gerenciar Empresas" actions={<CreateCompany />} />

			<div className="relative">
				<Search className="absolute left-5 top-1/2 -translate-1/2 size-4 text-muted-foreground" />
				<Input
					placeholder="Buscar por nome ou CNPJ..."
					className="h-10 w-full pl-10 sm:max-w-md"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>

			<section className="space-y-4">
				{filteredCompanies?.map((company) => (
					<CompanyCard key={company.id} company={company} />
				))}
			</section>
		</main>
	);
}
