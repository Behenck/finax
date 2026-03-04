import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SaleForm } from "./-components/sale-form";

const createSaleSearchSchema = z.object({
	customerId: z.uuid().optional(),
});

export const Route = createFileRoute("/_app/sales/create")({
	validateSearch: (search) => createSaleSearchSchema.parse(search),
	component: CreateSalePage,
});

function CreateSalePage() {
	const { customerId } = Route.useSearch();

	return (
		<main className="w-full space-y-6">
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold">Cadastrar Venda</h1>
					<span className="text-muted-foreground text-sm">
						Preencha os dados para registrar uma nova venda.
					</span>
				</div>
			</header>

			<SaleForm mode="CREATE" prefilledCustomerId={customerId} />
		</main>
	);
}

