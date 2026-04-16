import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugProductsIdCommissionScenarios } from "@/http/generated";
import { cn } from "@/lib/utils";

interface ProductScenarioBadgesProps {
	productId: string;
	className?: string;
	enabled?: boolean;
}

export function ProductScenarioBadges({
	productId,
	className,
	enabled = true,
}: ProductScenarioBadgesProps) {
	const { organization } = useApp();
	const { data } = useGetOrganizationsSlugProductsIdCommissionScenarios(
		{
			slug: organization?.slug ?? "",
			id: productId,
		},
		{
			query: {
				enabled: Boolean(enabled && organization?.slug && productId),
				staleTime: 5 * 60_000,
			},
		},
	);

	const scenarioNames = useMemo(() => {
		const names =
			data?.scenarios
				.map((scenario) => scenario.name.trim())
				.filter((name) => name.length > 0) ?? [];
		return Array.from(new Set(names));
	}, [data?.scenarios]);

	if (scenarioNames.length === 0) return null;

	return (
		<div className={cn("mt-1 flex flex-wrap items-center gap-1", className)}>
			{scenarioNames.map((scenarioName) => (
				<Badge
					key={scenarioName}
					variant="outline"
					className="max-w-full truncate text-[11px]"
				>
					{scenarioName}
				</Badge>
			))}
		</div>
	);
}
