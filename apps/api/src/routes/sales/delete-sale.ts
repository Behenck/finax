import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { cancelPendingSaleTransactionForSale } from "./sale-transactions";

export async function deleteSale(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.delete(
			"/organizations/:slug/sales/:saleId",
			{
				schema: {
					tags: ["sales"],
					summary: "Delete sale",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
					}),
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, saleId } = request.params;

				const organization = await prisma.organization.findUnique({
					where: {
						slug,
					},
					select: {
						id: true,
						enableSalesTransactionsSync: true,
					},
				});

				if (!organization) {
					throw new BadRequestError("Organization not found");
				}

				const sale = await prisma.sale.findFirst({
					where: {
						id: saleId,
						organizationId: organization.id,
					},
					select: {
						id: true,
					},
				});

				if (!sale) {
					throw new BadRequestError("Sale not found");
				}

				await db(() =>
					prisma.$transaction(async (tx) => {
						if (organization.enableSalesTransactionsSync) {
							await cancelPendingSaleTransactionForSale(tx, {
								saleId,
								organizationId: organization.id,
							});
						}

						await tx.sale.delete({
							where: {
								id: saleId,
							},
						});
					}),
				);

				return reply.status(204).send();
			},
		);
}
