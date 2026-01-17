import { getUnits } from "@/http/units/get-units";
import { useQuery } from "@tanstack/react-query";

export function useUnits(companyId?: string) {
	return useQuery({
		queryKey: ["units", companyId],
		queryFn: () => {
			if (!companyId) {
				throw new Error("companyId é obrigatório para buscar units");
			}

			return getUnits(companyId);
		},
		enabled: !!companyId,
	});
}
