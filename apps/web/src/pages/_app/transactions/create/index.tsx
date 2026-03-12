import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { useTransaction } from "@/hooks/transactions/use-transaction";
import { TransactionForm } from "../-components/transaction-form";

export const Route = createFileRoute("/_app/transactions/create/")({
	validateSearch: (search) =>
		z
			.object({
				duplicateTransactionId: z.uuid().optional(),
			})
			.parse(search),
	component: CreateTransaction,
});

function CreateTransaction() {
	const { duplicateTransactionId } = Route.useSearch();
	const duplicateTransactionQuery = useTransaction(duplicateTransactionId ?? "");

	if (duplicateTransactionId && duplicateTransactionQuery.isLoading) {
		return (
			<main className="space-y-6">
				<span className="text-muted-foreground">
					Carregando transação para duplicação...
				</span>
			</main>
		);
	}

	if (
		duplicateTransactionId &&
		(duplicateTransactionQuery.isError || !duplicateTransactionQuery.data)
	) {
		return (
			<main className="space-y-6">
				<span className="text-destructive">
					Não foi possível carregar a transação para duplicar.
				</span>
			</main>
		);
	}

	return (
		<main className="space-y-6">
			<header className="flex gap-6 items-center">
				<Button variant="ghost" size="icon-sm" asChild>
					<Link to="/transactions">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold">
						{duplicateTransactionId ? "Duplicar Transação" : "Nova Transação"}
					</h1>
					<span className="text-gray-500 text-sm">
						{duplicateTransactionId
							? "Revise os dados e salve uma nova transação baseada na selecionada."
							: "Adicione uma nova receita ou despesa"}
					</span>
				</div>
			</header>

			<TransactionForm initialData={duplicateTransactionQuery.data} />
		</main>
	);
}
