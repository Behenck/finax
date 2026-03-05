import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { SaleStatus } from "generated/prisma/enums";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	parseSaleDateInput,
	PatchSaleCommissionInstallmentStatusBodySchema,
} from "./sale-schemas";

function getCurrentDateUtc() {
	const now = new Date();
	return new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
}

export async function patchSaleCommissionInstallmentStatus(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/organizations/:slug/sales/:saleId/commission-installments/:installmentId/status",
			{
				schema: {
					tags: ["sales"],
					summary: "Update sale commission installment status",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
						installmentId: z.uuid(),
					}),
					body: PatchSaleCommissionInstallmentStatusBodySchema,
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, saleId, installmentId } = request.params;
				const { status, paymentDate } = request.body;

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

				const installment = await prisma.saleCommissionInstallment.findFirst({
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
					},
				});

				if (!installment) {
					throw new BadRequestError("Commission installment not found");
				}

				await db(() =>
					prisma.saleCommissionInstallment.update({
						where: {
							id: installment.id,
						},
						data: {
							status,
							paymentDate:
								status === "PAID"
									? (paymentDate
										? parseSaleDateInput(paymentDate)
										: getCurrentDateUtc())
									: null,
						},
					}),
				);

				return reply.status(204).send();
			},
		);
}
