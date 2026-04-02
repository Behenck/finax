import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { SaleStatus } from "@/schemas/types/sales";
import { SaleInstallmentsPanel } from "./sale-installments-panel";

interface SaleInstallmentsDrawerProps {
	open: boolean;
	onOpenChange(open: boolean): void;
	saleId: string;
	saleStatus: SaleStatus;
	saleProductId: string;
	saleCommissionId?: string;
}

export function SaleInstallmentsDrawer({
	open,
	onOpenChange,
	saleId,
	saleStatus,
	saleProductId,
	saleCommissionId,
}: SaleInstallmentsDrawerProps) {
	const isCommissionScoped = Boolean(saleCommissionId);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-full sm:max-w-5xl overflow-y-auto"
			>
				<SheetHeader>
					<SheetTitle>
						{isCommissionScoped
							? "Parcelas da comissão"
							: "Parcelas de comissão"}
					</SheetTitle>
					<SheetDescription>
						{isCommissionScoped
							? "Acompanhe e opere as parcelas da comissão selecionada."
							: "Acompanhe e opere as parcelas por comissionado."}
					</SheetDescription>
				</SheetHeader>

				<div className="px-4 pb-6">
					<SaleInstallmentsPanel
						saleId={saleId}
						saleStatus={saleStatus}
						saleProductId={saleProductId}
						saleCommissionId={saleCommissionId}
						enabled={open}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
