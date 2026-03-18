import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";

export async function getProduct(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/products/:id",
			{
				schema: {
					tags: ["products"],
					summary: "Get product",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						id: z.uuid(),
					}),
					response: {
						200: z.object({
							product: z.object({
								id: z.uuid(),
								name: z.string(),
								description: z.string().nullable(),
								parentId: z.uuid().nullable(),
								isActive: z.boolean(),
								sortOrder: z.number().int(),
								salesTransactionCategoryId: z.uuid().nullable(),
								salesTransactionCostCenterId: z.uuid().nullable(),
								createdAt: z.date(),
								updatedAt: z.date(),
							}),
						}),
					},
				},
			},
			async (request) => {
				const { slug, id } = request.params;

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
						name: true,
						description: true,
						parentId: true,
						isActive: true,
						sortOrder: true,
						salesTransactionCategoryId: true,
						salesTransactionCostCenterId: true,
						createdAt: true,
						updatedAt: true,
					},
				});

				if (!product) {
					throw new BadRequestError("Product not found");
				}

				return { product };
			},
		);
}
