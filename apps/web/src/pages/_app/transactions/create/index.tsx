import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { TransactionForm } from "../-components/transaction-form";

export const Route = createFileRoute("/_app/transactions/create/")({
	component: CreateTransaction,
});

function CreateTransaction() {
	return (
		<main className="space-y-6">
			<header className="flex gap-6 items-center">
				<Button variant="ghost" size="icon-sm" asChild>
					<Link to="/transactions">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold">Nova Transação</h1>
					<span className="text-gray-500 text-sm">
						Adicione uma nova receita ou despesa
					</span>
				</div>
			</header>

			<TransactionForm />
		</main>
	);
}
