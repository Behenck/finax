import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { assertProductSalesTransactionConfig } from "./product-sales-transaction-config";

export async function updateProduct(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/organizations/:slug/products/:id",
			{
				schema: {
					tags: ["products"],
					summary: "Update product",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						id: z.uuid(),
					}),
					body: z.object({
						name: z.string().min(1),
						description: z.string().nullable(),
						parentId: z.uuid().nullable(),
						isActive: z.boolean(),
						sortOrder: z.number().int().min(0),
						salesTransactionCategoryId: z.uuid().nullable().optional(),
						salesTransactionCostCenterId: z.uuid().nullable().optional(),
					}),
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, id } = request.params;
				const data = request.body;

				const organization = await prisma.organization.findUnique({
					where: { slug },
					select: { id: true },
				});

				if (!organization) {
					throw new BadRequestError("Organization not found");
				}

				const product = await prisma.product.findFirst({
					where: {
						id,
						organizationId: organization.id,
					},
					select: {
						id: true,
						parentId: true,
						isActive: true,
						salesTransactionCategoryId: true,
						salesTransactionCostCenterId: true,
						_count: {
							select: {
								children: true,
							},
						},
					},
				});

				if (!product) {
					throw new BadRequestError("Product not found");
				}

				if (data.parentId === id) {
					throw new BadRequestError("Product cannot be its own parent");
				}

				if (data.parentId !== null) {
					const parent = await prisma.product.findFirst({
						where: {
							id: data.parentId,
							organizationId: organization.id,
						},
						select: {
							id: true,
							isActive: true,
						},
					});

					if (!parent) {
						throw new BadRequestError("Parent product not found");
					}

					const isChangingParent = product.parentId !== data.parentId;
					if (isChangingParent && product._count.children > 0) {
						throw new BadRequestError(
							"Cannot move a product with children under another parent",
						);
					}

					if (data.isActive && !parent.isActive) {
						throw new BadRequestError(
							"Cannot activate a child product while parent is inactive",
						);
					}
				}

				const nextSalesTransactionCategoryId =
					data.salesTransactionCategoryId === undefined
						? product.salesTransactionCategoryId
						: data.salesTransactionCategoryId;
				const nextSalesTransactionCostCenterId =
					data.salesTransactionCostCenterId === undefined
						? product.salesTransactionCostCenterId
						: data.salesTransactionCostCenterId;

				await assertProductSalesTransactionConfig(prisma, organization.id, {
					salesTransactionCategoryId: nextSalesTransactionCategoryId,
					salesTransactionCostCenterId: nextSalesTransactionCostCenterId,
				});

				await db(() =>
					prisma.$transaction(async (tx) => {
						await tx.product.update({
							where: {
								id,
							},
							data: {
								name: data.name,
								description: data.description,
								parentId: data.parentId,
								isActive: data.isActive,
								sortOrder: data.sortOrder,
								salesTransactionCategoryId: nextSalesTransactionCategoryId,
								salesTransactionCostCenterId: nextSalesTransactionCostCenterId,
							},
						});

						if (product.isActive !== data.isActive) {
							const descendants: string[] = [];
							const visited = new Set<string>([id]);
							let parentIds = [id];

							while (parentIds.length > 0) {
								const children = await tx.product.findMany({
									where: {
										organizationId: organization.id,
										parentId: {
											in: parentIds,
										},
									},
									select: {
										id: true,
									},
								});

								const nextParentIds = children
									.map((child) => child.id)
									.filter((childId) => {
										if (visited.has(childId)) return false;
										visited.add(childId);
										return true;
									});

								descendants.push(...nextParentIds);
								parentIds = nextParentIds;
							}

							if (descendants.length > 0) {
								await tx.product.updateMany({
									where: {
										organizationId: organization.id,
										id: {
											in: descendants,
										},
									},
									data: {
										isActive: data.isActive,
									},
								});
							}
						}
					}),
				);

				return reply.status(204).send();
			},
		);
}
