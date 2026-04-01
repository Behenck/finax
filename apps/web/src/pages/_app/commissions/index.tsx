import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAbility } from "@/permissions/access";
import { CommissionReceiptImportWizard } from "./-components/commission-receipt-import-wizard";
import { CommissionsDataTable } from "./-components/commissions-data-table";

export const Route = createFileRoute("/_app/commissions/")({
	component: CommissionsPage,
});

function CommissionsPage() {
	const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
	const ability = useAbility();
	const canManageSalesImports = ability.can("access", "sales.import.manage");

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Comissões"
				description="Acompanhe parcelas de comissão a pagar e a receber, com filtros e ações operacionais."
				actions={
					canManageSalesImports ? (
						<Button
							variant="outline"
							className="w-full sm:w-auto"
							onClick={() => setIsImportWizardOpen(true)}
						>
							<FileSpreadsheet className="size-4" />
							Importar recebimentos
						</Button>
					) : null
				}
			/>

			<CommissionsDataTable />
			<CommissionReceiptImportWizard
				open={isImportWizardOpen}
				onOpenChange={setIsImportWizardOpen}
			/>
		</main>
	);
}
