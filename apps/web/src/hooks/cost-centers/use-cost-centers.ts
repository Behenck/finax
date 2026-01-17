import { getCostCenters } from "@/http/cost-centers/get-cost-centers";
import { useQuery } from "@tanstack/react-query";

export function useCostCenters() {
	return useQuery({
		queryKey: ["cost-centers"],
		queryFn: getCostCenters,
	});
}
