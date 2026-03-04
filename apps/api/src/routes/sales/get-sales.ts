import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
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
					};
				});

				return {
					sales: result,
				};
			},
		);
}

