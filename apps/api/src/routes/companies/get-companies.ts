import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { unitResponseSchema } from "../units/unit-schemas";

export async function getCompanies(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/companies",
			{
				schema: {
					tags: ["companies"],
					summary: "Get companies",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					response: {
						200: z.object({
							companies: z.array(
								z.object({
									id: z.uuid(),
									name: z.string(),
									units: z.array(unitResponseSchema),
									employees: z.array(
										z.object({
											id: z.uuid(),
											name: z.string(),
											department: z.string().nullable(),
										}),
									),
								}),
							),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;

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

				const companies = await prisma.company.findMany({
					where: {
						organizationId: organization.id,
					},
					select: {
						id: true,
						name: true,
						units: {
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
						},
						employees: {
							select: {
								id: true,
								name: true,
								department: true,
							},
						},
					},
				});

				return { companies };
			},
		);
}
