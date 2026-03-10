import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugSalesSaleidHistory } from "@/http/generated";

export function useSaleHistory(saleId: string) {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useGetOrganizationsSlugSalesSaleidHistory(
		{ slug, saleId },
		{
			query: {
				enabled: Boolean(organization?.slug && saleId),
			},
		},
	);
}
