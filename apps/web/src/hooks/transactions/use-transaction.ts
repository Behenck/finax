import { getTransaction } from "@/http/transactions/get-transaction"
import { useQuery } from "@tanstack/react-query"

export function useTransaction(transactionId: string) {
	return useQuery({
		queryKey: ["transaction", transactionId],
		enabled: !!transactionId,
		queryFn: () => getTransaction(transactionId),
	})
}
