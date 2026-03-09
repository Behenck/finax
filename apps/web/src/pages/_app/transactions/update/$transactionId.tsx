import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { TransactionForm } from "../-components/transaction-form";
import { useTransaction } from "@/hooks/transactions/use-transaction";

export const Route = createFileRoute("/_app/transactions/update/$transactionId")({
  component: UpdateTransaction,
});

function UpdateTransaction() {
  const { transactionId } = Route.useParams()
  const { data: transaction } = useTransaction(transactionId)

  return (
    <main className="space-y-6">
      <header className="flex gap-6 items-center">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/transactions">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Editar Transação</h1>
        </div>
      </header>

      <TransactionForm initialData={transaction} />
    </main>
  );
}
