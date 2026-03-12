import { getTransaction } from "@/http/transactions/get-transaction"
import { useApp } from "@/context/app-context";
import { useQuery } from "@tanstack/react-query"

export function useTransaction(transactionId: string) {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";

	return useQuery({
		queryKey: ["transaction", slug, transactionId],
		enabled: Boolean(transactionId && slug),
		queryFn: () =>
			getTransaction({
				slug,
				transactionId,
			}),
	})
}
