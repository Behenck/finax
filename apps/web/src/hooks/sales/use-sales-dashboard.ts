import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugSalesDashboard } from "@/http/generated";

export function useSalesDashboard(month: string) {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useGetOrganizationsSlugSalesDashboard(
		{
			slug,
			params: {
				month,
			},
		},
		{
			query: {
				enabled: Boolean(organization?.slug && month),
			},
		},
	);
}
