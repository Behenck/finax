import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
	title: string;
	description?: ReactNode;
	actions?: ReactNode;
	className?: string;
}

export function PageHeader({
	title,
	description,
	actions,
	className,
}: PageHeaderProps) {
	return (
		<header
			className={cn(
				"flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
				className,
			)}
		>
			<div className="min-w-0 space-y-1">
				<h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
				{description ? (
					<p className="text-sm text-muted-foreground">{description}</p>
				) : null}
			</div>

			{actions ? (
				<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
					{actions}
				</div>
			) : null}
		</header>
	);
}

