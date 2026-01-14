import type { FastifyInstance } from "fastify";
import { createTransaction } from "./create-transaction";
import { updateTransaction } from "./update-transaction";
import { deleteTransaction } from "./delete-transaction";
import { getTransactions } from "./get-transactions";

export async function companyRoutes(app: FastifyInstance) {
  await app.register(createTransaction);
  await app.register(updateTransaction);
  await app.register(deleteTransaction);
  await app.register(getTransactions);
}