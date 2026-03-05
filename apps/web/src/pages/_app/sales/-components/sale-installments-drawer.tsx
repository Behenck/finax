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
}

export function SaleInstallmentsDrawer({
	open,
	onOpenChange,
	saleId,
	saleStatus,
}: SaleInstallmentsDrawerProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-full sm:max-w-5xl overflow-y-auto"
			>
				<SheetHeader>
					<SheetTitle>Parcelas de comissão</SheetTitle>
					<SheetDescription>
						Acompanhe e opere as parcelas por comissionado.
					</SheetDescription>
				</SheetHeader>

				<div className="px-4 pb-6">
					<SaleInstallmentsPanel
						saleId={saleId}
						saleStatus={saleStatus}
						enabled={open}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
