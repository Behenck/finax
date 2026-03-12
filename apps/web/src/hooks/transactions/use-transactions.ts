import { getTransactions } from "@/http/transactions/get-transactions";
import type { GetOrganizationsSlugTransactionsQueryParams } from "@/http/generated";
import { useApp } from "@/context/app-context";
import { useQuery } from "@tanstack/react-query";

export function useTransactions(filters: GetOrganizationsSlugTransactionsQueryParams = {}) {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useQuery({
		queryKey: ["transactions", slug, filters],
		enabled: Boolean(slug),
		queryFn: () =>
			getTransactions({
				slug,
				filters,
			}),
	});
}
