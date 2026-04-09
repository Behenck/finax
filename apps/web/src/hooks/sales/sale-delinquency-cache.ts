import type { QueryClient } from "@tanstack/react-query";
import {
	getOrganizationsSlugSalesDelinquencyQueryKey,
	getOrganizationsSlugSalesQueryKey,
	getOrganizationsSlugSalesSaleidHistoryQueryKey,
	getOrganizationsSlugSalesSaleidQueryKey,
} from "@/http/generated";

interface InvalidateSaleDelinquencyRelatedQueriesParams {
	queryClient: QueryClient;
	slug: string;
	saleId: string;
	customerId?: string;
}

export async function invalidateSaleDelinquencyRelatedQueries({
	queryClient,
	slug,
	saleId,
	customerId,
}: InvalidateSaleDelinquencyRelatedQueriesParams) {
	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: getOrganizationsSlugSalesQueryKey({ slug }),
		}),
		queryClient.invalidateQueries({
			queryKey: getOrganizationsSlugSalesSaleidQueryKey({ slug, saleId }),
		}),
		queryClient.invalidateQueries({
			queryKey: getOrganizationsSlugSalesSaleidHistoryQueryKey({ slug, saleId }),
		}),
		queryClient.invalidateQueries({
			queryKey: getOrganizationsSlugSalesDelinquencyQueryKey({ slug }),
		}),
		queryClient.invalidateQueries({
			predicate: (query) => {
				const firstKey = Array.isArray(query.queryKey) ? query.queryKey[0] : null;
				if (!firstKey || typeof firstKey !== "object") {
					return false;
				}

				const key = firstKey as {
					url?: string;
					params?: {
						slug?: string;
						customerId?: string;
					};
				};

				if (key.url !== "/organizations/:slug/customers/:customerId") {
					return false;
				}

				if (key.params?.slug !== slug) {
					return false;
				}

				if (!customerId) {
					return true;
				}

				return key.params?.customerId === customerId;
			},
		}),
	]);
}
