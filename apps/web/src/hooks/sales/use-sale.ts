import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugSalesSaleid } from "@/http/generated";

export function useSale(saleId: string) {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useGetOrganizationsSlugSalesSaleid(
		{ slug, saleId },
		{
			query: {
				enabled: Boolean(organization?.slug && saleId),
			},
		},
	);
}

