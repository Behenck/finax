import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import { CustomerStatus } from "generated/prisma/enums";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	replaceSaleCommissions,
	resolveSaleCommissionsData,
} from "./sale-commissions";
import {
	loadProductSaleFieldSchema,
	normalizeSaleDynamicFieldValues,
} from "./sale-dynamic-fields";
import {
	createSaleCreatedHistoryEvent,
	loadSaleHistorySnapshot,
} from "./sale-history";
import { resolveSaleResponsibleData } from "./sale-responsible";
import { CreateSaleBodySchema, parseSaleDateInput } from "./sale-schemas";

export async function createSale(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/sales",
			{
				schema: {
					tags: ["sales"],
					summary: "Create a new sale",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: CreateSaleBodySchema,
					response: {
						201: z.object({
							saleId: z.uuid(),
						}),
					},
				},
			},
			async (request, reply) => {
				const { slug } = request.params;
				const data = request.body;
				const userId = await request.getCurrentUserId();
				const hasCommissionInput =
					Array.isArray(data.commissions) && data.commissions.length > 0;

				if (hasCommissionInput) {
					await request.requirePermission(slug, "sales.commissions.create");
				}

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

				const dynamicFieldSchema = await loadProductSaleFieldSchema(
					prisma,
					product.id,
				);
				const dynamicFieldValues = normalizeSaleDynamicFieldValues({
					schema: dynamicFieldSchema,
					input: data.dynamicFields,
				});

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
					{
						allowInactivePartner: true,
					},
				);
				const resolvedCommissions = data.commissions
					? await resolveSaleCommissionsData(
							organization.id,
							data.commissions,
							data.totalAmount,
						)
					: [];

				const sale = await db(() =>
					prisma.$transaction(async (tx) => {
						const createdSale = await tx.sale.create({
							data: {
								organizationId: organization.id,
								companyId: data.companyId,
								unitId: data.unitId,
								customerId: data.customerId,
								productId: data.productId,
								saleDate: parseSaleDateInput(data.saleDate),
								totalAmount: data.totalAmount,
								notes: data.notes ?? null,
								dynamicFieldSchema:
									dynamicFieldSchema as unknown as Prisma.InputJsonValue,
								dynamicFieldValues:
									dynamicFieldValues as unknown as Prisma.InputJsonValue,
								createdById: userId,
								...responsibleData,
							},
						});

						if (resolvedCommissions.length > 0) {
							await replaceSaleCommissions(
								tx,
								createdSale.id,
								resolvedCommissions,
							);
						}

						const snapshot = await loadSaleHistorySnapshot(
							tx,
							createdSale.id,
							organization.id,
						);

						if (!snapshot) {
							throw new BadRequestError("Sale not found");
						}

						await createSaleCreatedHistoryEvent(tx, {
							saleId: createdSale.id,
							organizationId: organization.id,
							actorId: userId,
							snapshot,
						});

						return createdSale;
					}),
				);

				return reply.status(201).send({
					saleId: sale.id,
				});
			},
		);
}
