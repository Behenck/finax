import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugSales } from "@/http/generated";

export function useSales() {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useGetOrganizationsSlugSales(
		{ slug },
		{
			query: {
				enabled: Boolean(organization?.slug),
			},
		},
	);
}

