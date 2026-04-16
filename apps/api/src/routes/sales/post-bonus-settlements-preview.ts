import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { handlePrismaError } from "../_errors/prisma-error";
import {
	calculateBonusSettlementPreview,
	getCurrentDateUtc,
	mapBonusSettlementPreviewResponse,
} from "./bonus-settlement-calculator";
import {
	parseSaleDateInput,
	PostBonusSettlementsBodySchema,
	PostBonusSettlementsPreviewResponseSchema,
} from "./sale-schemas";

export async function postBonusSettlementsPreview(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/commissions/bonus-settlements/preview",
			{
				schema: {
					tags: ["sales"],
					summary: "Preview bonus scenario winners for a closed period",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: PostBonusSettlementsBodySchema,
					response: {
						200: PostBonusSettlementsPreviewResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const {
					productId,
					periodFrequency,
					periodYear,
					periodIndex,
					settledAt,
				} = request.body;

				try {
					const { organization } = await request.getUserMembership(slug);
					const settledAtDate = settledAt
						? parseSaleDateInput(settledAt)
						: getCurrentDateUtc();

					const calculation = await db(() =>
						prisma.$transaction((tx) =>
							calculateBonusSettlementPreview({
								tx,
								organizationId: organization.id,
								productId,
								periodFrequency,
								periodYear,
								periodIndex,
								settledAtDate,
								allowSettled: true,
							}),
						),
					);

					return mapBonusSettlementPreviewResponse(calculation);
				} catch (error) {
					handlePrismaError(error);
				}
			},
		);
}
