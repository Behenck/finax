import { format, parse } from "date-fns";
import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SaleDelinquencySummaryLike = {
	hasOpen: boolean;
	openCount: number;
	oldestDueDate: string | null;
	latestDueDate: string | null;
};

interface SaleDelinquencyBadgeProps {
	summary: SaleDelinquencySummaryLike;
	className?: string;
	showOldestDueDate?: boolean;
}

function formatDate(value: string) {
	return format(parse(value.slice(0, 10), "yyyy-MM-dd", new Date()), "dd/MM/yyyy");
}

export function SaleDelinquencyBadge({
	summary,
	className,
	showOldestDueDate = false,
}: SaleDelinquencyBadgeProps) {
	if (!summary.hasOpen) {
		return null;
	}

	const countLabel =
		summary.openCount === 1
			? "1 inadimplência"
			: `${summary.openCount} inadimplências`;

	return (
		<Badge
			variant="outline"
			className={cn(
				"border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
				className,
			)}
		>
			<TriangleAlert className="size-3.5" />
			<span>{countLabel}</span>
			{showOldestDueDate && summary.oldestDueDate ? (
				<span className="text-current/80">desde {formatDate(summary.oldestDueDate)}</span>
			) : null}
		</Badge>
	);
}
