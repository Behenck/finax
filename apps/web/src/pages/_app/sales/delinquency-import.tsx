import { createFileRoute } from "@tanstack/react-router";
import { SaleDelinquencyImportWizard } from "./-components/import-delinquency/sale-delinquency-import-wizard";

export const Route = createFileRoute("/_app/sales/delinquency-import")({
	component: SaleDelinquencyImportPage,
});

function SaleDelinquencyImportPage() {
	return <SaleDelinquencyImportWizard />;
}
