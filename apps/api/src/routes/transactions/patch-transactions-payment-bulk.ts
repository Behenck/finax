import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { TransactionStatus } from "generated/prisma/enums";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";

const PatchTransactionsPaymentBulkBodySchema = z
	.object({
		transactionIds: z.array(z.uuid()).min(1).max(100),
		paymentDate: z.coerce.date().optional(),
	})
	.strict();

const PatchTransactionsPaymentBulkResponseSchema = z.object({
	updatedCount: z.number().int().nonnegative(),
	skipped: z.array(
		z.object({
			transactionId: z.uuid(),
			reason: z.enum(["ALREADY_PAID", "CANCELED"]),
		}),
	),
});

export async function patchTransactionsPaymentBulk(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/organizations/:slug/transactions/payment/bulk",
			{
				schema: {
					tags: ["transactions"],
					summary: "Bulk payment transaction",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: PatchTransactionsPaymentBulkBodySchema,
					response: {
						200: PatchTransactionsPaymentBulkResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { transactionIds, paymentDate } = request.body;

				const parsedPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

				const organization = await prisma.organization.findUnique({
					where: {
						slug,
					},
					select: {
						id: true,
					},
				});

				if (!organization) {
					throw new BadRequestError("Organization not found");
				}

				const uniqueTransactionIds = Array.from(new Set(transactionIds));

				const transactions = await prisma.transaction.findMany({
					where: {
						organizationId: organization.id,
						id: {
							in: uniqueTransactionIds,
						},
					},
					select: {
						id: true,
						status: true,
					},
				});

				if (transactions.length !== uniqueTransactionIds.length) {
					throw new BadRequestError("One or more transactions were not found");
				}

				const eligibleIds: string[] = [];
				const skipped: Array<{
					transactionId: string;
					reason: "ALREADY_PAID" | "CANCELED";
				}> = [];

				for (const transaction of transactions) {
					if (transaction.status === TransactionStatus.PAID) {
						skipped.push({
							transactionId: transaction.id,
							reason: "ALREADY_PAID",
						});
						continue;
					}

					if (transaction.status === TransactionStatus.CANCELED) {
						skipped.push({
							transactionId: transaction.id,
							reason: "CANCELED",
						});
						continue;
					}

					eligibleIds.push(transaction.id);
				}

				if (eligibleIds.length > 0) {
					await db(() =>
						prisma.transaction.updateMany({
							where: {
								id: {
									in: eligibleIds,
								},
								organizationId: organization.id,
							},
							data: {
								status: TransactionStatus.PAID,
								paymentDate: parsedPaymentDate,
							},
						}),
					);
				}

				return {
					updatedCount: eligibleIds.length,
					skipped,
				};
			},
		);
}
