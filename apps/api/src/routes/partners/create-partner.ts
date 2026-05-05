import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";
import {
	assertSupervisorUserIds,
	replacePartnerSupervisors,
} from "./partner-supervisors";
import {
	normalizePartnerWriteBody,
	partnerWriteBodySchema,
} from "./partner-payload";

export async function createPartner(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/partners",
			{
				schema: {
					tags: ["partners"],
					summary: "Create a new partner",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: partnerWriteBodySchema,
					response: {
						201: z.object({
							partnerId: z.uuid(),
						}),
					},
				},
			},
			async (request, reply) => {
				const { slug } = request.params;
				const data = normalizePartnerWriteBody(request.body);

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

				const supervisorIds = await assertSupervisorUserIds(
					organization.id,
					data.supervisorIds ?? [],
				);

				const partner = await db(() =>
					prisma.partner.create({
						data: {
							name: data.name,
							email: data.email,
							phone: data.phone,
							companyName: data.companyName,
							documentType: data.documentType,
							document: data.document,
							country: data.country,
							state: data.state,
							city: data.city,
							street: data.street,
							zipCode: data.zipCode,
							neighborhood: data.neighborhood,
							number: data.number,
							complement: data.complement,
							status: data.status,
							organizationId: organization.id,
						},
					}),
				);

				if (data.supervisorIds !== undefined) {
					await replacePartnerSupervisors({
						organizationId: organization.id,
						partnerId: partner.id,
						supervisorIds,
					});
				}

				return reply.status(201).send({
					partnerId: partner.id,
				});
			},
		);
}
