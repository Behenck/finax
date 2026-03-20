import { useApp } from "@/context/app-context";
import {
	type GetOrganizationsSlugCommissionsInstallmentsQueryParams,
	useGetOrganizationsSlugCommissionsInstallments,
} from "@/http/generated";

interface UseCommissionInstallmentsOptions {
	enabled?: boolean;
}

export type CommissionInstallmentsFilters =
	GetOrganizationsSlugCommissionsInstallmentsQueryParams & {
		companyId?: string;
		unitId?: string;
	};

export function useCommissionInstallments(
	params: CommissionInstallmentsFilters,
	options?: UseCommissionInstallmentsOptions,
) {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useGetOrganizationsSlugCommissionsInstallments(
		{
			slug,
			params,
		},
		{
			query: {
				enabled: Boolean(organization?.slug && (options?.enabled ?? true)),
			},
		},
	);
}
