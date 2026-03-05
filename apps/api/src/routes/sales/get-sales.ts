import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { SaleCommissionInstallmentStatus } from "generated/prisma/enums";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { SaleSummarySchema } from "./sale-schemas";
import { loadSalesResponsible } from "./sale-responsible";

export async function getSales(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/sales",
			{
				schema: {
					tags: ["sales"],
					summary: "Get sales",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					response: {
						200: z.object({
							sales: z.array(SaleSummarySchema),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;

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

				const sales = await prisma.sale.findMany({
					where: {
						organizationId: organization.id,
					},
					orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
					select: {
						id: true,
						saleDate: true,
						totalAmount: true,
						status: true,
						notes: true,
						createdAt: true,
						updatedAt: true,
						responsibleType: true,
						responsibleId: true,
						customer: {
							select: {
								id: true,
								name: true,
							},
						},
						product: {
							select: {
								id: true,
								name: true,
							},
						},
						company: {
							select: {
								id: true,
								name: true,
							},
						},
						unit: {
							select: {
								id: true,
								name: true,
							},
						},
						createdBy: {
							select: {
								id: true,
								name: true,
								avatarUrl: true,
							},
						},
					},
				});

				const responsibleBySaleId = await loadSalesResponsible(
					organization.id,
					sales,
				);
				const saleIds = sales.map((sale) => sale.id);
				const commissionInstallmentsSummaryBySaleId = new Map<
					string,
					{ total: number; pending: number; paid: number; canceled: number }
				>(
					saleIds.map((saleId) => [
						saleId,
						{
							total: 0,
							pending: 0,
							paid: 0,
							canceled: 0,
						},
					]),
				);

				if (saleIds.length > 0) {
					const commissionInstallments =
						await prisma.saleCommissionInstallment.findMany({
							where: {
								saleCommission: {
									saleId: {
										in: saleIds,
									},
								},
							},
							select: {
								status: true,
								saleCommission: {
									select: {
										saleId: true,
									},
								},
							},
						});

					for (const installment of commissionInstallments) {
						const summary = commissionInstallmentsSummaryBySaleId.get(
							installment.saleCommission.saleId,
						);
						if (!summary) {
							continue;
						}

						summary.total += 1;
						if (installment.status === SaleCommissionInstallmentStatus.PENDING) {
							summary.pending += 1;
						} else if (
							installment.status === SaleCommissionInstallmentStatus.PAID
						) {
							summary.paid += 1;
						} else if (
							installment.status === SaleCommissionInstallmentStatus.CANCELED
						) {
							summary.canceled += 1;
						}
					}
				}

				const result = sales.map((sale) => {
					return {
						id: sale.id,
						saleDate: sale.saleDate,
						totalAmount: sale.totalAmount,
						status: sale.status,
						notes: sale.notes,
						createdAt: sale.createdAt,
						updatedAt: sale.updatedAt,
						customer: sale.customer,
						product: sale.product,
						company: sale.company,
						unit: sale.unit,
						createdBy: sale.createdBy,
						responsible: responsibleBySaleId.get(sale.id) ?? null,
						commissionInstallmentsSummary:
							commissionInstallmentsSummaryBySaleId.get(sale.id) ?? {
								total: 0,
								pending: 0,
								paid: 0,
								canceled: 0,
							},
					};
				});

				return {
					sales: result,
				};
			},
		);
}
