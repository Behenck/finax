import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { auth } from "@/middleware/auth";
import {
	SALE_JSON_IMPORT_BODY_LIMIT_BYTES,
	SaleJsonImportPreviewBodySchema,
	SaleJsonImportPreviewResponseSchema,
} from "./sale-json-import-schemas";
import { previewSaleJsonImport } from "./sale-json-import-service";

export async function postSaleJsonImportPreview(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/sales/json-imports/preview",
			{
				bodyLimit: SALE_JSON_IMPORT_BODY_LIMIT_BYTES,
				schema: {
					tags: ["sales"],
					summary: "Preview sale JSON import",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: SaleJsonImportPreviewBodySchema,
					response: {
						200: SaleJsonImportPreviewResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const { organization } = await request.getUserMembership(slug);

				return previewSaleJsonImport(organization.id, request.body);
			},
		);
}
