import { useApp } from "@/context/app-context";
import { useGetOrganizationsSlugSalesSaleidCommissionInstallments } from "@/http/generated";

export function useSaleCommissionInstallments(
	saleId: string,
	options?: {
		enabled?: boolean;
	},
) {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useGetOrganizationsSlugSalesSaleidCommissionInstallments(
		{ slug, saleId },
		{
			query: {
				enabled: Boolean(
					organization?.slug && saleId && (options?.enabled ?? true),
				),
			},
		},
	);
}
