import { createFileRoute } from "@tanstack/react-router";
import { ImportSalesWizard } from "./-components/import-sales/import-sales-wizard";

export const Route = createFileRoute("/_app/sales/import")({
	component: ImportSalesPage,
});

function ImportSalesPage() {
	return <ImportSalesWizard />;
}
