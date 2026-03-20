import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { useAbility } from "@/permissions/access";
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
	const ability = useAbility();
	const canCreateTransactions = ability.can("access", "transactions.create");
	const { duplicateTransactionId } = Route.useSearch();
	const duplicateTransactionQuery = useTransaction(duplicateTransactionId ?? "");

	if (!canCreateTransactions) {
		return (
			<Card className="p-6">
				<span className="text-muted-foreground">
					Você não possui permissão para cadastrar transações.
				</span>
			</Card>
		);
	}

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
			<PageHeader
				title={duplicateTransactionId ? "Duplicar Transação" : "Nova Transação"}
				description={
					duplicateTransactionId
						? "Revise os dados e salve uma nova transação baseada na selecionada."
						: "Adicione uma nova receita ou despesa"
				}
				actions={
					<Button variant="outline" asChild className="w-full sm:w-auto">
						<Link to="/transactions">
							<ArrowLeft className="size-4" />
							Voltar
						</Link>
					</Button>
				}
			/>

			<TransactionForm initialData={duplicateTransactionQuery.data} />
		</main>
	);
}
