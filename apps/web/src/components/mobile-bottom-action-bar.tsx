import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MobileBottomActionBarProps {
	children: ReactNode;
	className?: string;
}

export function MobileBottomActionBar({
	children,
	className,
}: MobileBottomActionBarProps) {
	return (
		<div
			className={cn(
				"fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden",
				className,
			)}
		>
			<div className="mx-auto max-w-screen-xl">{children}</div>
		</div>
	);
}

