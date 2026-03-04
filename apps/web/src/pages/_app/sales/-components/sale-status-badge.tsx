import { Badge } from "@/components/ui/badge";
import { SALE_STATUS_LABEL, type SaleStatus } from "@/schemas/types/sales";

const SALE_STATUS_CLASSNAME: Record<SaleStatus, string> = {
	PENDING: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
	APPROVED: "bg-blue-500/15 text-blue-700 border-blue-500/30",
	COMPLETED: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
	CANCELED: "bg-red-500/15 text-red-700 border-red-500/30",
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

