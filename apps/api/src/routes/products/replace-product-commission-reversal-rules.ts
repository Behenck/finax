import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { handlePrismaError } from "../_errors/prisma-error";
import {
	ReplaceProductCommissionReversalRulesBodySchema,
	toScaledReversalPercentage,
} from "./commission-reversal-rules-schema";

const paramsSchema = z.object({
	slug: z.string(),
	id: z.uuid(),
});

export async function replaceProductCommissionReversalRules(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/organizations/:slug/products/:id/commission-reversal-rules",
			{
				schema: {
					tags: ["products"],
					summary: "Replace product commission reversal rules",
					security: [{ bearerAuth: [] }],
					params: paramsSchema,
					body: ReplaceProductCommissionReversalRulesBodySchema,
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, id } = request.params;
				const { rules } = request.body;

				try {
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

					await db(() =>
						prisma.$transaction(async (tx) => {
							await tx.productCommissionReversalRule.deleteMany({
								where: {
									productId: product.id,
								},
							});

							if (rules.length > 0) {
								await tx.productCommissionReversalRule.createMany({
									data: rules.map((rule) => ({
										productId: product.id,
										installmentNumber: rule.installmentNumber,
										percentage: toScaledReversalPercentage(rule.percentage),
									})),
								});
							}
						}),
					);

					return reply.status(204).send();
				} catch (error) {
					handlePrismaError(error);
				}
			},
		);
}
