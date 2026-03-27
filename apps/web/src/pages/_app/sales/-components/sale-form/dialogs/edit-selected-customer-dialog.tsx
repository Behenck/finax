import { FormCustomer } from "@/pages/_app/registers/customers/-components/form-customer";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugCustomersCustomerid } from "@/http/generated";

interface EditSelectedCustomerDialogProps {
	open: boolean;
	customerId?: string;
	onOpenChange(open: boolean): void;
	onUpdated(): void | Promise<void>;
}

export function EditSelectedCustomerDialog({
	open,
	customerId,
	onOpenChange,
	onUpdated,
}: EditSelectedCustomerDialogProps) {
	const { organization } = useApp();
	const hasCustomerId = Boolean(customerId);
	const shouldFetchCustomer =
		open && hasCustomerId && Boolean(organization?.slug);

	const {
		data,
		isLoading,
		isError,
		refetch,
	} = useGetOrganizationsSlugCustomersCustomerid(
		{
			slug: organization?.slug ?? "",
			customerId: customerId ?? "",
		},
		{
			query: {
				enabled: shouldFetchCustomer,
			},
		},
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Editar cliente</DialogTitle>
					<DialogDescription>
						Atualize os dados do cliente selecionado sem sair da venda.
					</DialogDescription>
				</DialogHeader>

				{!hasCustomerId ? (
					<p className="text-muted-foreground text-sm">
						Selecione um cliente para editar.
					</p>
				) : null}

				{hasCustomerId && isLoading ? (
					<p className="text-muted-foreground text-sm">Carregando cliente...</p>
				) : null}

				{hasCustomerId && isError ? (
					<div className="space-y-3">
						<p className="text-destructive text-sm">
							Erro ao carregar os dados do cliente.
						</p>
						<Button
							type="button"
							variant="outline"
							onClick={() => refetch()}
						>
							Tentar novamente
						</Button>
					</div>
				) : null}

				{hasCustomerId && !isLoading && !isError && !data?.customer ? (
					<p className="text-muted-foreground text-sm">
						Cliente não encontrado.
					</p>
				) : null}

				{hasCustomerId && data?.customer ? (
					<FormCustomer
						type="UPDATE"
						variant="dialog"
						customer={data.customer}
						onCancel={() => onOpenChange(false)}
						onSuccess={onUpdated}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
