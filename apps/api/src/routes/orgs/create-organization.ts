import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { createSlug } from "@/utils/create-slug";

export async function createOrganization(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations",
			{
				schema: {
					tags: ["organizations"],
					summary: "Create a new organization",
					security: [{ bearerAuth: [] }],
					body: z.object({
						name: z.string(),
						domain: z.string().nullish(),
						shouldAttachUserByDomain: z.boolean().optional(),
						enableSalesTransactionsSync: z.boolean().optional(),
					}),
					response: {
						201: z.object({
							organizationId: z.uuid(),
						}),
					},
				},
			},
			async (request, reply) => {
				const userId = await request.getCurrentUserId();
				const {
					name,
					domain,
					shouldAttachUserByDomain,
					enableSalesTransactionsSync,
				} = request.body;

				if (domain) {
					const organizationByDomain = await prisma.organization.findUnique({
						where: { domain },
					});

					if (organizationByDomain) {
						throw new BadRequestError(
							"Another organization with some domain already exists.",
						);
					}
				}

				const organization = await prisma.organization.create({
					data: {
						name,
						slug: createSlug(name),
						domain,
						shouldAttachUserByDomain,
						enableSalesTransactionsSync,
						ownerId: userId,
						members: {
							create: {
								userId,
								role: "ADMIN",
							},
						},
					},
				});

				return reply.status(201).send({
					organizationId: organization.id,
				});
			},
		);
}
