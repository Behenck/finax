import { useApp } from "@/context/app-context";
import {
	type GetOrganizationsSlugCommissionsInstallmentsQueryParams,
	useGetOrganizationsSlugCommissionsInstallments,
} from "@/http/generated";

interface UseCommissionInstallmentsOptions {
	enabled?: boolean;
}

export function useCommissionInstallments(
	params: GetOrganizationsSlugCommissionsInstallmentsQueryParams,
	options?: UseCommissionInstallmentsOptions,
) {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useGetOrganizationsSlugCommissionsInstallments(
		{ slug, params },
		{
			query: {
				enabled: Boolean(organization?.slug && (options?.enabled ?? true)),
			},
		},
	);
}
