import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { buildProductTree } from "@/utils/build-product-tree";
import { BadRequestError } from "../_errors/bad-request-error";

const ProductTreeNodeSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	description: z.string().nullable(),
	parentId: z.uuid().nullable(),
	isActive: z.boolean(),
	sortOrder: z.number().int(),
	// Avoid recursive $ref generation that breaks OpenAPI/Kubb.
	children: z.array(z.unknown()),
});

export async function getProducts(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/products",
			{
				schema: {
					tags: ["products"],
					summary: "Get products",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					response: {
						200: z.object({
							products: z.array(ProductTreeNodeSchema),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;

				const organization = await prisma.organization.findUnique({
					where: { slug },
					select: { id: true },
				});

				if (!organization) {
					throw new BadRequestError("Organization not found");
				}

				const flatProducts = await prisma.product.findMany({
					where: {
						organizationId: organization.id,
					},
					select: {
						id: true,
						name: true,
						description: true,
						parentId: true,
						isActive: true,
						sortOrder: true,
					},
					orderBy: [
						{
							sortOrder: "asc",
						},
						{
							name: "asc",
						},
					],
				});

				const products = buildProductTree(flatProducts);

				return { products };
			},
		);
}
