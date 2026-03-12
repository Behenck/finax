import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	normalizeCaseInsensitiveLabel,
	ReplaceProductSaleFieldsBodySchema,
} from "./sale-fields-schema";

const paramsSchema = z.object({
	slug: z.string(),
	id: z.uuid(),
});

export async function replaceProductSaleFields(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/organizations/:slug/products/:id/sale-fields",
			{
				schema: {
					tags: ["products"],
					summary: "Replace product sale fields",
					security: [{ bearerAuth: [] }],
					params: paramsSchema,
					body: ReplaceProductSaleFieldsBodySchema,
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, id } = request.params;
				const { fields } = request.body;

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
						await tx.productSaleField.deleteMany({
							where: {
								productId: product.id,
							},
						});

						for (const [fieldIndex, field] of fields.entries()) {
							await tx.productSaleField.create({
								data: {
									productId: product.id,
									label: field.label,
									labelNormalized: normalizeCaseInsensitiveLabel(field.label),
									type: field.type,
									required: field.required,
									sortOrder: fieldIndex,
									options: {
										create: field.options.map((option, optionIndex) => ({
											label: option.label,
											labelNormalized: normalizeCaseInsensitiveLabel(option.label),
											isDefault: option.isDefault,
											sortOrder: optionIndex,
										})),
									},
								},
							});
						}
					}),
				);

				return reply.status(204).send();
			},
		);
}
