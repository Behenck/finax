import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type LoadingRevealProps = {
	loading: boolean;
	skeleton: ReactNode;
	children: ReactNode;
	className?: string;
	contentKey?: string | number;
	animation?: "fade-up" | "none";
	stagger?: boolean;
};

export function LoadingReveal({
	loading,
	skeleton,
	children,
	className,
	contentKey,
	animation = "fade-up",
	stagger = false,
}: LoadingRevealProps) {
	if (loading) {
		return <>{skeleton}</>;
	}

	return (
		<div
			key={contentKey ?? "default"}
			data-slot="loading-reveal"
			data-animation={animation}
			data-stagger={stagger ? "true" : undefined}
			className={cn(
				animation === "fade-up" && !stagger && "animate-content-reveal",
				stagger && "animate-content-reveal-stagger",
				className,
			)}
		>
			{children}
		</div>
	);
}
