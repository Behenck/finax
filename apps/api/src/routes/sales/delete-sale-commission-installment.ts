import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { SaleStatus } from "generated/prisma/enums";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	renumberSaleCommissionInstallments,
	syncSaleCommissionTotalPercentage,
} from "./sale-commissions";

export async function deleteSaleCommissionInstallment(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.delete(
			"/organizations/:slug/sales/:saleId/commission-installments/:installmentId",
			{
				schema: {
					tags: ["sales"],
					summary: "Delete sale commission installment",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
						installmentId: z.uuid(),
					}),
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, saleId, installmentId } = request.params;

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

				const sale = await prisma.sale.findFirst({
					where: {
						id: saleId,
						organizationId: organization.id,
					},
					select: {
						id: true,
						status: true,
					},
				});

				if (!sale) {
					throw new BadRequestError("Sale not found");
				}

				if (sale.status === SaleStatus.PENDING) {
					throw new BadRequestError(
						"Cannot update commission installments while sale is pending",
					);
				}

				if (sale.status === SaleStatus.CANCELED) {
					throw new BadRequestError(
						"Cannot update commission installments for canceled sale",
					);
				}

				await db(() =>
					prisma.$transaction(async (tx) => {
						const installment = await tx.saleCommissionInstallment.findFirst({
							where: {
								id: installmentId,
								saleCommission: {
									saleId,
									sale: {
										organizationId: organization.id,
									},
								},
							},
							select: {
								id: true,
								saleCommissionId: true,
							},
						});

						if (!installment) {
							throw new BadRequestError("Commission installment not found");
						}

						const commissionInstallmentsCount =
							await tx.saleCommissionInstallment.count({
								where: {
									saleCommissionId: installment.saleCommissionId,
								},
							});

						if (commissionInstallmentsCount <= 1) {
							throw new BadRequestError(
								"Cannot delete the last installment of a commission",
							);
						}

						await tx.saleCommissionInstallment.delete({
							where: {
								id: installment.id,
							},
						});

						await renumberSaleCommissionInstallments(
							tx,
							installment.saleCommissionId,
						);
						await syncSaleCommissionTotalPercentage(
							tx,
							installment.saleCommissionId,
						);
					}),
				);

				return reply.status(204).send();
			},
		);
}
