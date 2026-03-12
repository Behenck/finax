import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FilterPanelProps {
	children: ReactNode;
	className?: string;
}

export function FilterPanel({ children, className }: FilterPanelProps) {
	return (
		<div
			className={cn(
				"grid grid-cols-1 gap-3 rounded-md border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
				className,
			)}
		>
			{children}
		</div>
	);
}

