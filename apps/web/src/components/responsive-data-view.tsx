import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResponsiveDataViewProps {
	mobile: ReactNode;
	desktop: ReactNode;
	mobileClassName?: string;
	desktopClassName?: string;
}

export function ResponsiveDataView({
	mobile,
	desktop,
	mobileClassName,
	desktopClassName,
}: ResponsiveDataViewProps) {
	return (
		<>
			<div className={cn("md:hidden", mobileClassName)}>{mobile}</div>
			<div className={cn("hidden md:block", desktopClassName)}>{desktop}</div>
		</>
	);
}

