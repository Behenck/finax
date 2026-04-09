import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugSalesDashboardPartners } from "@/http/generated";

interface UsePartnerSalesDashboardParams {
	startDate: string;
	endDate: string;
	inactiveMonths: number;
	supervisorId?: string;
	partnerIds?: string;
	dynamicFieldId?: string;
	productBreakdownDepth?: "FIRST_LEVEL" | "ALL_LEVELS";
}

export function usePartnerSalesDashboard({
	startDate,
	endDate,
	inactiveMonths,
	supervisorId,
	partnerIds,
	dynamicFieldId,
	productBreakdownDepth,
}: UsePartnerSalesDashboardParams) {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useGetOrganizationsSlugSalesDashboardPartners(
		{
			slug,
			params: {
				startDate,
				endDate,
				inactiveMonths,
				supervisorId: supervisorId || undefined,
				partnerIds: partnerIds || undefined,
				dynamicFieldId: dynamicFieldId || undefined,
				productBreakdownDepth,
			},
		},
		{
			query: {
				enabled: Boolean(organization?.slug && startDate && endDate),
			},
		},
	);
}
