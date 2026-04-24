import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isSaleInPreCancellation } from "@/utils/sale-pre-cancellation";

type SaleDelinquencySummaryLike = {
	openCount: number;
};

interface SalePreCancellationBadgeProps {
	threshold: number | null | undefined;
	summary: SaleDelinquencySummaryLike;
	className?: string;
}

export function SalePreCancellationBadge({
	threshold,
	summary,
	className,
}: SalePreCancellationBadgeProps) {
	if (!isSaleInPreCancellation({ threshold, summary })) {
		return null;
	}

	return (
		<Badge
			variant="outline"
			className={cn(
				"border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
				className,
			)}
		>
			<AlertTriangle className="size-3.5" />
			<span>Pré-cancelamento</span>
		</Badge>
	);
}
