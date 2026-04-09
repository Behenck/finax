import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugSalesDelinquency } from "@/http/generated";

export function useSalesDelinquency() {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useGetOrganizationsSlugSalesDelinquency(
		{ slug },
		{
			query: {
				enabled: Boolean(organization?.slug),
			},
		},
	);
}
