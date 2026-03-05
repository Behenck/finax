import { createFileRoute } from "@tanstack/react-router";
import { CommissionsDataTable } from "./-components/commissions-data-table";

export const Route = createFileRoute("/_app/commissions/")({
	component: CommissionsPage,
});

function CommissionsPage() {
	return (
		<main className="w-full space-y-6">
			<header className="space-y-1">
				<h1 className="text-2xl font-semibold">Comissões</h1>
				<p className="text-muted-foreground text-sm">
					Acompanhe parcelas de comissão a pagar e a receber, com filtros e ações
					operacionais.
				</p>
			</header>

			<CommissionsDataTable />
		</main>
	);
}
