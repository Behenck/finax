import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { loadOrganizationCommissionInstallments } from "./sale-commissions";
import {
	GetOrganizationCommissionInstallmentsQuerySchema,
	OrganizationCommissionInstallmentsResponseSchema,
	parseSaleDateInput,
} from "./sale-schemas";

export async function getOrganizationCommissionInstallments(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/commissions/installments",
			{
				schema: {
					tags: ["sales"],
					summary: "Get organization commission installments",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					querystring: GetOrganizationCommissionInstallmentsQuerySchema,
					response: {
						200: OrganizationCommissionInstallmentsResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const {
					page,
					pageSize,
					q,
					productId,
					direction,
					status,
					expectedFrom,
					expectedTo,
				} = request.query;

				const organization = await prisma.organization.findUnique({
					where: {
						slug,
					},
					select: {
						id: true,
					},
				});

				if (!organization) {
					throw new BadRequestError("Organization not found");
				}

				const expectedFromDate = expectedFrom
					? parseSaleDateInput(expectedFrom)
					: undefined;
				const expectedToDate = expectedTo
					? parseSaleDateInput(expectedTo)
					: undefined;

				if (
					expectedFromDate &&
					expectedToDate &&
					expectedFromDate > expectedToDate
				) {
					throw new BadRequestError(
						"expectedFrom must be less than or equal to expectedTo",
					);
				}

				return loadOrganizationCommissionInstallments({
					organizationId: organization.id,
					page,
					pageSize,
					q,
					productId,
					direction,
					status,
					expectedFrom: expectedFromDate,
					expectedTo: expectedToDate,
				});
			},
		);
}
