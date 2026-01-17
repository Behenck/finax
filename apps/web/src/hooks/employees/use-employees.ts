import { getEmployees } from "@/http/employees/get-employees";
import { useQuery } from "@tanstack/react-query";

export function useEmployees() {
	return useQuery({
		queryKey: ["employees"],
		queryFn: getEmployees,
	});
}
