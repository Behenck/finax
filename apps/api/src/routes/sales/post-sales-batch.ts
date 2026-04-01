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
	loadProductSaleFieldSchema,
	normalizeSaleDynamicFieldValues,
	type SaleDynamicFieldSchemaSnapshot,
} from "./sale-dynamic-fields";
import {
	createSaleCreatedHistoryEvent,
	loadSaleHistorySnapshot,
} from "./sale-history";
import { resolveSaleResponsibleData } from "./sale-responsible";
import {
	CreateSaleBatchBodySchema,
	CreateSaleBatchResponseSchema,
	parseSaleDateInput,
} from "./sale-schemas";

type ProductScopeNode = {
	id: string;
	parentId: string | null;
	isActive: boolean;
};

function resolveAllowedProductScope(
	parentProductId: string,
	products: ProductScopeNode[],
) {
	const productsById = new Map(
		products.map((product) => [product.id, product]),
	);
	const childrenByParentId = new Map<string, string[]>();

	for (const product of products) {
		if (!product.parentId) {
			continue;
		}

		const currentChildren = childrenByParentId.get(product.parentId) ?? [];
		currentChildren.push(product.id);
		childrenByParentId.set(product.parentId, currentChildren);
	}

	const parentProduct = productsById.get(parentProductId);
	if (!parentProduct || !parentProduct.isActive) {
		throw new BadRequestError("Parent product not found or inactive");
	}

	const allowedProductIds = new Set<string>([parentProductId]);
	const queue = [parentProductId];
	const visited = new Set<string>();

	while (queue.length > 0) {
		const currentProductId = queue.shift();
		if (!currentProductId || visited.has(currentProductId)) {
			continue;
		}
		visited.add(currentProductId);

		const children = childrenByParentId.get(currentProductId) ?? [];
		for (const childId of children) {
			if (allowedProductIds.has(childId)) {
				continue;
			}

			allowedProductIds.add(childId);
			queue.push(childId);
		}
	}

	return {
		allowedProductIds,
		productsById,
	};
}

function resolveItemErrorMessage(itemIndex: number, message: string) {
	return `Item ${itemIndex + 1}: ${message}`;
}

export async function postSalesBatch(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/sales/batch",
			{
				schema: {
					tags: ["sales"],
					summary: "Create sales in batch transactionally",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: CreateSaleBatchBodySchema,
					response: {
						201: CreateSaleBatchResponseSchema,
					},
				},
			},
			async (request, reply) => {
				const { slug } = request.params;
				const data = request.body;
				const userId = await request.getCurrentUserId();

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

				const company = await prisma.company.findFirst({
					where: {
						organizationId: organization.id,
						id: data.companyId,
					},
					select: {
						id: true,
					},
				});

				if (!company) {
					throw new BadRequestError("Company not found");
				}

				const customerIds = Array.from(
					new Set(data.items.map((item) => item.customerId)),
				);
				const customers = await prisma.customer.findMany({
					where: {
						id: {
							in: customerIds,
						},
						organizationId: organization.id,
						status: CustomerStatus.ACTIVE,
					},
					select: {
						id: true,
					},
				});
				const activeCustomerIds = new Set(
					customers.map((customer) => customer.id),
				);

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

				const organizationProducts = await prisma.product.findMany({
					where: {
						organizationId: organization.id,
					},
					select: {
						id: true,
						parentId: true,
						isActive: true,
					},
				});

				const { allowedProductIds, productsById } = resolveAllowedProductScope(
					data.parentProductId,
					organizationProducts,
				);

				const saleIds = await db(() =>
					prisma.$transaction(async (tx) => {
						const createdSaleIds: string[] = [];
						const dynamicFieldSchemaByProductId = new Map<
							string,
							SaleDynamicFieldSchemaSnapshot
						>();

						for (const [itemIndex, item] of data.items.entries()) {
							try {
								if (!activeCustomerIds.has(item.customerId)) {
									throw new BadRequestError("Customer not found or inactive");
								}

								if (!allowedProductIds.has(item.productId)) {
									throw new BadRequestError(
										"Product is outside selected parent scope",
									);
								}

								const product = productsById.get(item.productId);
								if (!product || !product.isActive) {
									throw new BadRequestError("Product not found or inactive");
								}

								let dynamicFieldSchema = dynamicFieldSchemaByProductId.get(
									item.productId,
								);
								if (!dynamicFieldSchema) {
									dynamicFieldSchema = await loadProductSaleFieldSchema(
										tx,
										item.productId,
									);
									dynamicFieldSchemaByProductId.set(
										item.productId,
										dynamicFieldSchema,
									);
								}

								const dynamicFieldValues = normalizeSaleDynamicFieldValues({
									schema: dynamicFieldSchema,
									input: item.dynamicFields,
								});

								const sale = await tx.sale.create({
									data: {
										organizationId: organization.id,
										companyId: data.companyId,
										unitId: data.unitId,
										customerId: item.customerId,
										productId: item.productId,
										saleDate: parseSaleDateInput(item.saleDate),
										totalAmount: item.totalAmount,
										notes: null,
										dynamicFieldSchema:
											dynamicFieldSchema as unknown as Prisma.InputJsonValue,
										dynamicFieldValues:
											dynamicFieldValues as unknown as Prisma.InputJsonValue,
										createdById: userId,
										...responsibleData,
									},
								});

								const snapshot = await loadSaleHistorySnapshot(
									tx,
									sale.id,
									organization.id,
								);
								if (!snapshot) {
									throw new BadRequestError("Sale not found");
								}

								await createSaleCreatedHistoryEvent(tx, {
									saleId: sale.id,
									organizationId: organization.id,
									actorId: userId,
									snapshot,
								});

								createdSaleIds.push(sale.id);
							} catch (error) {
								if (error instanceof BadRequestError) {
									throw new BadRequestError(
										resolveItemErrorMessage(itemIndex, error.message),
									);
								}

								throw error;
							}
						}

						return createdSaleIds;
					}),
				);

				return reply.status(201).send({
					saleIds,
					createdCount: saleIds.length,
				});
			},
		);
}
