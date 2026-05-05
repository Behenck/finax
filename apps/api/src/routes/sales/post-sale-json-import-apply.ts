import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { auth } from "@/middleware/auth";
import {
	SALE_JSON_IMPORT_BODY_LIMIT_BYTES,
	SaleJsonImportApplyBodySchema,
	SaleJsonImportApplyResponseSchema,
} from "./sale-json-import-schemas";
import { applySaleJsonImport, previewSaleJsonImport } from "./sale-json-import-service";

export async function postSaleJsonImportApply(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/sales/json-imports/apply",
			{
				bodyLimit: SALE_JSON_IMPORT_BODY_LIMIT_BYTES,
				schema: {
					tags: ["sales"],
					summary: "Apply sale JSON import",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: SaleJsonImportApplyBodySchema,
					response: {
						200: SaleJsonImportApplyResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const actorId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);
				const preview = await previewSaleJsonImport(organization.id, request.body);

				if (preview.hasCommissions) {
					await request.requirePermission(slug, "sales.commissions.create");
				}

				return applySaleJsonImport({
					organizationId: organization.id,
					actorId,
					body: request.body,
				});
			},
		);
}
