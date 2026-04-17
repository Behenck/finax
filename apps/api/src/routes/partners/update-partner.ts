import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import { db } from "@/lib/db";
import { PartnerDocumentType, PartnerStatus } from "generated/prisma/enums";
import {
	assertSupervisorUserIds,
	replacePartnerSupervisors,
} from "./partner-supervisors";

export async function updatePartner(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/organizations/:slug/partners/:partnerId",
			{
				schema: {
					tags: ["partners"],
					summary: "Update employee",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						partnerId: z.uuid(),
					}),
					body: z.object({
						name: z.string(),
						email: z.string(),
						phone: z.string(),
						companyName: z.string(),
						documentType: z.enum(PartnerDocumentType),
						document: z.string(),
						country: z.string(),
						state: z.string(),
						city: z.string().optional(),
						street: z.string().optional(),
						zipCode: z.string().optional(),
						neighborhood: z.string().optional(),
						number: z.string().optional(),
						complement: z.string().optional(),
						status: z.enum(PartnerStatus).optional(),
						supervisorIds: z.array(z.uuid()).optional(),
					}),
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, partnerId } = request.params;
				const data = request.body;

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

				const partner = await prisma.partner.findFirst({
					where: {
						id: partnerId,
						organizationId: organization.id,
					},
					select: { id: true },
				});

				if (!partner) {
					throw new BadRequestError("Partner not found");
				}

				const supervisorIds = data.supervisorIds
					? await assertSupervisorUserIds(organization.id, data.supervisorIds)
					: [];

				await db(() =>
					prisma.partner.update({
						where: {
							id: partnerId,
						},
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
						},
					}),
				);

				if (data.supervisorIds !== undefined) {
					await replacePartnerSupervisors({
						organizationId: organization.id,
						partnerId,
						supervisorIds,
					});
				}

				return reply.status(204).send();
			},
		);
}
