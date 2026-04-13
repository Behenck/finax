import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	assertSaleDelinquencyImportRateLimit,
	saleDelinquencyImportRateLimit,
} from "./sale-delinquency-import-rate-limit";
import {
	GetSaleDelinquencyImportSearchFieldsQuerySchema,
	SaleDelinquencyImportSearchFieldsResponseSchema,
} from "./sale-delinquency-import-schemas";

export async function getSaleDelinquencyImportSearchFields(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/sales/delinquency/import-search-fields",
			{
				schema: {
					tags: ["sales"],
					summary: "List available custom search fields for sale delinquency import",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					querystring: GetSaleDelinquencyImportSearchFieldsQuerySchema,
					response: {
						200: SaleDelinquencyImportSearchFieldsResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { productId } = request.query;
				const userId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				assertSaleDelinquencyImportRateLimit(
					`${organization.id}:${userId}:sale-delinquency-import-search-fields:list`,
					saleDelinquencyImportRateLimit.templates,
				);

				if (productId) {
					const product = await prisma.product.findFirst({
						where: {
							id: productId,
							organizationId: organization.id,
						},
						select: {
							id: true,
						},
					});

					if (!product) {
						throw new BadRequestError("Product not found");
					}
				}

				const fields = await prisma.productSaleField.findMany({
					where: {
						productId: productId,
						product: {
							organizationId: organization.id,
						},
					},
					select: {
						label: true,
						labelNormalized: true,
					},
					orderBy: [{ labelNormalized: "asc" }, { label: "asc" }],
				});

				const uniqueLabels = new Set<string>();
				const uniqueFields: Array<{ label: string }> = [];

				for (const field of fields) {
					if (uniqueLabels.has(field.labelNormalized)) {
						continue;
					}

					uniqueLabels.add(field.labelNormalized);
					uniqueFields.push({
						label: field.label,
					});
				}

				return {
					fields: uniqueFields,
				};
			},
		);
}
