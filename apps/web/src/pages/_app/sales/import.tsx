import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportSalesWizard } from "./-components/import-sales/import-sales-wizard";
import { JsonSalesImportWizard } from "./-components/import-sales/json-sales-import-wizard";

export const Route = createFileRoute("/_app/sales/import")({
	component: ImportSalesPage,
});

function ImportSalesPage() {
	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Importar vendas"
				description="Importação por planilha ou JSON com conferência antes da gravação."
				actions={
					<Button asChild variant="outline">
						<Link to="/sales">Voltar para vendas</Link>
					</Button>
				}
			/>

			<Tabs defaultValue="spreadsheet" className="space-y-6">
				<TabsList>
					<TabsTrigger value="spreadsheet">Planilha</TabsTrigger>
					<TabsTrigger value="json">JSON</TabsTrigger>
				</TabsList>
				<TabsContent value="spreadsheet">
					<ImportSalesWizard hideHeader />
				</TabsContent>
				<TabsContent value="json">
					<JsonSalesImportWizard />
				</TabsContent>
			</Tabs>
		</main>
	);
}
