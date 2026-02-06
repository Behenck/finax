import { getTransactions } from "@/http/transactions/get-transactions";
import { useQuery } from "@tanstack/react-query";

export function useTransactions() {
	return useQuery({
		queryKey: ["transactions"],
		queryFn: getTransactions,
	});
}
