import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CustomerStatus } from "generated/prisma/enums";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	recalculatePersistedSaleCommissionsAmounts,
	replaceSaleCommissions,
	resolveSaleCommissionsData,
} from "./sale-commissions";
import { resolveSaleResponsibleData } from "./sale-responsible";
import { parseSaleDateInput, UpdateSaleBodySchema } from "./sale-schemas";

export async function updateSale(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/organizations/:slug/sales/:saleId",
			{
				schema: {
					tags: ["sales"],
					summary: "Update sale",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
					}),
					body: UpdateSaleBodySchema,
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, saleId } = request.params;
				const data = request.body;

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

				if (sale.status !== "PENDING" && data.commissions !== undefined) {
					throw new BadRequestError(
						"Cannot update commissions when sale status is not PENDING",
					);
				}

				const customer = await prisma.customer.findFirst({
					where: {
						id: data.customerId,
						organizationId: organization.id,
						status: CustomerStatus.ACTIVE,
					},
					select: {
						id: true,
					},
				});

				if (!customer) {
					throw new BadRequestError("Customer not found or inactive");
				}

				const product = await prisma.product.findFirst({
					where: {
						id: data.productId,
						organizationId: organization.id,
						isActive: true,
					},
					select: {
						id: true,
					},
				});

				if (!product) {
					throw new BadRequestError("Product not found or inactive");
				}

				const company = await prisma.company.findFirst({
					where: {
						id: data.companyId,
						organizationId: organization.id,
					},
					select: {
						id: true,
					},
				});

				if (!company) {
					throw new BadRequestError("Company not found");
				}

				if (data.unitId) {
					const unit = await prisma.unit.findFirst({
						where: {
							id: data.unitId,
							companyId: data.companyId,
						},
						select: {
							id: true,
						},
					});

					if (!unit) {
						throw new BadRequestError("Unit not found for company");
					}
				}

				const responsibleData = await resolveSaleResponsibleData(
					organization.id,
					data.responsible,
				);
				const resolvedCommissions =
					data.commissions === undefined
						? undefined
						: await resolveSaleCommissionsData(
								organization.id,
								data.commissions,
								data.totalAmount,
							);

				await db(() =>
					prisma.$transaction(async (tx) => {
						await tx.sale.update({
							where: {
								id: saleId,
							},
							data: {
								companyId: data.companyId,
								unitId: data.unitId,
								customerId: data.customerId,
								productId: data.productId,
								saleDate: parseSaleDateInput(data.saleDate),
								totalAmount: data.totalAmount,
								notes: data.notes ?? null,
								...responsibleData,
							},
						});

						if (resolvedCommissions !== undefined) {
							await replaceSaleCommissions(tx, saleId, resolvedCommissions);
						} else {
							await recalculatePersistedSaleCommissionsAmounts(
								tx,
								saleId,
								data.totalAmount,
							);
						}
					}),
				);

				return reply.status(204).send();
			},
		);
}
