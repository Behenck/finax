import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { SaleHistoryAction, SaleStatus } from "generated/prisma/enums";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	createSaleDiffHistoryEvent,
	loadSaleHistorySnapshot,
} from "./sale-history";
import {
	PatchSaleCommissionInstallmentStatusBodySchema,
	parseSaleDateInput,
} from "./sale-schemas";

function getCurrentDateUtc() {
	const now = new Date();
	return new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
}

export async function patchSaleCommissionInstallmentStatus(
	app: FastifyInstance,
) {
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
				const { status, paymentDate, amount } = request.body;
				const actorId = await request.getCurrentUserId();

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

				const beforeSnapshot = await loadSaleHistorySnapshot(
					prisma,
					saleId,
					organization.id,
				);

				if (!beforeSnapshot) {
					throw new BadRequestError("Sale not found");
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
						status: true,
						paymentDate: true,
					},
				});

				if (!installment) {
					throw new BadRequestError("Commission installment not found");
				}

				await db(() =>
					prisma.$transaction(async (tx) => {
						await tx.saleCommissionInstallment.update({
							where: {
								id: installment.id,
							},
							data: {
								status,
								paymentDate:
									status === "PAID"
										? paymentDate
											? parseSaleDateInput(paymentDate)
											: installment.status === "PAID" &&
													installment.paymentDate
												? installment.paymentDate
												: getCurrentDateUtc()
										: null,
								...(amount === undefined ? {} : { amount }),
							},
						});

						const afterSnapshot = await loadSaleHistorySnapshot(
							tx,
							saleId,
							organization.id,
						);

						if (!afterSnapshot) {
							throw new BadRequestError("Sale not found");
						}

						await createSaleDiffHistoryEvent(tx, {
							saleId,
							organizationId: organization.id,
							actorId,
							action: SaleHistoryAction.COMMISSION_INSTALLMENT_STATUS_UPDATED,
							beforeSnapshot,
							afterSnapshot,
						});
					}),
				);

				return reply.status(204).send();
			},
		);
}
