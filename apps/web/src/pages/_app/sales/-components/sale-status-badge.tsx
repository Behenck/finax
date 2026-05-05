import { Badge } from "@/components/ui/badge";
import { SALE_STATUS_LABEL, type SaleStatus } from "@/schemas/types/sales";

const SALE_STATUS_CLASSNAME: Record<SaleStatus, string> = {
	PENDING: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
	COMPLETED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
	CANCELED: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

interface SaleStatusBadgeProps {
	status: SaleStatus;
}

export function SaleStatusBadge({ status }: SaleStatusBadgeProps) {
	return (
		<Badge variant="outline" className={SALE_STATUS_CLASSNAME[status]}>
			{SALE_STATUS_LABEL[status]}
		</Badge>
	);
}
