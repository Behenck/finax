import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { unitResponseSchema } from "./unit-schemas";

export async function getUnits(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/companies/:companyId/units",
			{
				schema: {
					tags: ["units"],
					summary: "Get units",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						companyId: z.uuid(),
					}),
					response: {
						200: z.object({
							units: z.array(unitResponseSchema),
						}),
					},
				},
			},
			async (request) => {
				const { slug, companyId } = request.params;

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

				const company = await prisma.company.findFirst({
					where: {
						id: companyId,
						organizationId: organization.id,
					},
					select: {
						id: true,
					},
				});

				if (!company) {
					throw new BadRequestError("Company not found");
				}

				const units = await prisma.unit.findMany({
					where: {
						companyId,
					},
					select: {
						id: true,
						name: true,
						country: true,
						state: true,
						city: true,
						street: true,
						zipCode: true,
						neighborhood: true,
						number: true,
						complement: true,
					},
				});

				return { units };
			},
		);
}
