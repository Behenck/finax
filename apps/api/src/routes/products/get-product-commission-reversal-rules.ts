import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { handlePrismaError } from "../_errors/prisma-error";
import {
	fromScaledReversalPercentage,
	GetProductCommissionReversalRulesResponseSchema,
} from "./commission-reversal-rules-schema";

const paramsSchema = z.object({
	slug: z.string(),
	id: z.uuid(),
});

const querystringSchema = z.object({
	includeInherited: z.coerce.boolean().optional().default(false),
});

export async function getProductCommissionReversalRules(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/products/:id/commission-reversal-rules",
			{
				schema: {
					tags: ["products"],
					summary: "Get product commission reversal rules",
					security: [{ bearerAuth: [] }],
					params: paramsSchema,
					querystring: querystringSchema,
					response: {
						200: GetProductCommissionReversalRulesResponseSchema,
					},
				},
			},
			async (request) => {
				try {
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

					let rules: Array<{
						installmentNumber: number;
						percentage: number;
					}> = [];

					if (!includeInherited) {
						rules = await prisma.productCommissionReversalRule.findMany({
							where: {
								productId: product.id,
							},
							orderBy: {
								installmentNumber: "asc",
							},
							select: {
								installmentNumber: true,
								percentage: true,
							},
						});
					} else {
						const visitedProductIds = new Set<string>();
						let currentProductId: string | null = product.id;

						while (currentProductId) {
							if (visitedProductIds.has(currentProductId)) {
								break;
							}
							visitedProductIds.add(currentProductId);

							const lineageProduct: {
								id: string;
								parentId: string | null;
							} | null = await prisma.product.findFirst({
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

							rules = await prisma.productCommissionReversalRule.findMany({
								where: {
									productId: lineageProduct.id,
								},
								orderBy: {
									installmentNumber: "asc",
								},
								select: {
									installmentNumber: true,
									percentage: true,
								},
							});

							if (rules.length > 0) {
								break;
							}

							currentProductId = lineageProduct.parentId;
						}
					}

					return {
						rules: rules.map((rule) => ({
							installmentNumber: rule.installmentNumber,
							percentage: fromScaledReversalPercentage(rule.percentage),
						})),
					};
				} catch (error) {
					handlePrismaError(error);
				}
			},
		);
}
