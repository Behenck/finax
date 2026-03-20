import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { createTransaction } from "./create-transaction";
import { updateTransaction } from "./update-transaction";
import { deleteTransaction } from "./delete-transaction";
import { getTransactions } from "./get-transactions";
import { paymentTransaction } from "./payment-transaction";
import { patchTransactionsPaymentBulk } from "./patch-transactions-payment-bulk";
import { getTransaction } from "./get-transaction";

function resolveTransactionsPermission(params: { method: string; routeUrl: string }) {
	const { method, routeUrl } = params;

	if (
		routeUrl === "/organizations/:slug/transactions/payment/bulk" ||
		(routeUrl === "/organizations/:slug/transactions/:transactionId" &&
			method === "PATCH")
	) {
		return "transactions.payment.manage" as const;
	}

	if (routeUrl === "/organizations/:slug/transactions" && method === "GET") {
		return "transactions.view" as const;
	}

	if (
		routeUrl === "/organizations/:slug/transactions/:transactionId" &&
		method === "GET"
	) {
		return "transactions.view" as const;
	}

	if (routeUrl === "/organizations/:slug/transactions" && method === "POST") {
		return "transactions.create" as const;
	}

	if (
		routeUrl === "/organizations/:slug/transactions/:transactionId" &&
		method === "PUT"
	) {
		return "transactions.update" as const;
	}

	if (
		routeUrl === "/organizations/:slug/transactions/:transactionId" &&
		method === "DELETE"
	) {
		return "transactions.delete" as const;
	}

	return null;
}

export async function transactionRoutes(app: FastifyInstance) {
  registerModulePermissionGuard(app, resolveTransactionsPermission);

  await app.register(createTransaction);
  await app.register(updateTransaction);
  await app.register(deleteTransaction);
  await app.register(getTransactions);
  await app.register(getTransaction);
  await app.register(paymentTransaction);
  await app.register(patchTransactionsPaymentBulk);
}
