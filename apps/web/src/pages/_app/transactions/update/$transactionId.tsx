import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
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
      <PageHeader
        title="Editar Transação"
        description="Atualize os dados da transação selecionada."
        actions={
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link to="/transactions">
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <TransactionForm initialData={transaction} />
    </main>
  );
}
