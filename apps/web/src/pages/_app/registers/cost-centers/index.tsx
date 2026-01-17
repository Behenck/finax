import { Input } from "@/components/ui/input";
import { useCostCenters } from "@/hooks/cost-centers/use-cost-centers";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CreateCostCenter } from "./-components/create-cost-center";
import { CostCenterCard } from "./-components/cost-center-card";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/registers/cost-centers/")({
	component: CostCenters,
});

function CostCenters() {
	const [search, setSearch] = useState("");
	const { data: costCenters, isLoading, isError } = useCostCenters();

	const safeCostCenters = costCenters ?? [];

	const filteredCostCenters = useMemo(() => {
		if (!search.trim()) return safeCostCenters;

		const query = search.toLowerCase();

		return safeCostCenters.filter((costCenters) => {
			const costCenterMatch = costCenters.name.toLowerCase().includes(query);

			return costCenterMatch;
		});
	}, [safeCostCenters, search]);

	if (isLoading) return <h1>Carregando...</h1>;

	if (isError) {
		return (
			<p className="text-destructive">Erro ao carregar centros de custos.</p>
		);
	}

	return (
		<main className="w-full space-y-6">
			<header className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Gerenciar Centros de Custos</h1>

				<CreateCostCenter />
			</header>

			<div className="relative">
				<Search className="absolute left-5 top-1/2 -translate-1/2 size-4 text-gray-500" />
				<Input
					placeholder="Buscar por nome..."
					className="max-w-[40%] h-10 pl-10"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>

			<section className="space-y-4">
				{filteredCostCenters?.map((costCenter) => (
					<CostCenterCard costCenter={costCenter} />
				))}
			</section>
		</main>
	);
}
