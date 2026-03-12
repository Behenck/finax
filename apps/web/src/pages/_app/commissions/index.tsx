import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { CommissionsDataTable } from "./-components/commissions-data-table";

export const Route = createFileRoute("/_app/commissions/")({
	component: CommissionsPage,
});

function CommissionsPage() {
	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Comissões"
				description="Acompanhe parcelas de comissão a pagar e a receber, com filtros e ações operacionais."
			/>

			<CommissionsDataTable />
		</main>
	);
}
