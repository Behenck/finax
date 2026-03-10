import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { GetProductSaleFieldsResponseSchema } from "./sale-fields-schema";

const paramsSchema = z.object({
	slug: z.string(),
	id: z.uuid(),
});

const querystringSchema = z.object({
	includeInherited: z.coerce.boolean().optional().default(false),
});

export async function getProductSaleFields(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/products/:id/sale-fields",
			{
				schema: {
					tags: ["products"],
					summary: "Get product sale fields",
					security: [{ bearerAuth: [] }],
					params: paramsSchema,
					querystring: querystringSchema,
					response: {
						200: GetProductSaleFieldsResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug, id } = request.params;
				const { includeInherited } = request.query;

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
					},
				});

				if (!product) {
					throw new BadRequestError("Product not found");
				}

				const productIdsToLoad: string[] = [product.id];
				if (includeInherited) {
					const lineageProductIds: string[] = [];
					const visitedProductIds = new Set<string>();
					let currentProductId: string | null = product.id;

					while (currentProductId) {
						if (visitedProductIds.has(currentProductId)) {
							break;
						}
						visitedProductIds.add(currentProductId);

						const lineageProduct: { id: string; parentId: string | null } | null =
							await prisma.product.findFirst({
								where: {
									id: currentProductId,
									organizationId: organization.id,
								},
								select: {
									id: true,
									parentId: true,
								},
							});

						if (!lineageProduct) {
							break;
						}

						lineageProductIds.unshift(lineageProduct.id);
						currentProductId = lineageProduct.parentId;
					}

					if (lineageProductIds.length > 0) {
						productIdsToLoad.splice(0, productIdsToLoad.length, ...lineageProductIds);
					}
				}

				const fieldCollections = await Promise.all(
					productIdsToLoad.map((productId) =>
						prisma.productSaleField.findMany({
							where: {
								productId,
							},
							orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
							select: {
								id: true,
								label: true,
								labelNormalized: true,
								type: true,
								required: true,
								options: {
									orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
									select: {
										id: true,
										label: true,
									},
								},
							},
						}),
					),
				);

				const mergedFields = new Map<
					string,
					{
						id: string;
						label: string;
						type: (typeof fieldCollections)[number][number]["type"];
						required: boolean;
						options: Array<{ id: string; label: string }>;
					}
				>();
				for (const fields of fieldCollections) {
					for (const field of fields) {
						// Child field overrides parent when labels are equal.
						if (mergedFields.has(field.labelNormalized)) {
							mergedFields.delete(field.labelNormalized);
						}

						mergedFields.set(field.labelNormalized, {
							id: field.id,
							label: field.label,
							type: field.type,
							required: field.required,
							options: field.options,
						});
					}
				}

				return {
					fields: Array.from(mergedFields.values()),
				};
			},
		);
}
