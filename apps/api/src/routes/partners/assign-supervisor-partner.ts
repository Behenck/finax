import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	assertSupervisorUserIds,
	replacePartnerSupervisors,
} from "./partner-supervisors";

const assignSupervisorBodySchema = z
	.object({
		supervisorIds: z.array(z.uuid()).optional(),
		supervisorId: z.uuid().nullable().optional(),
	})
	.refine(
		(body) =>
			Array.isArray(body.supervisorIds) ||
			Object.hasOwn(body, "supervisorId"),
		{
			message: "supervisorIds or supervisorId is required",
		},
	);

export async function assignSupervisorPartner(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/organizations/:slug/partners/:partnerId/assign-supervisor",
			{
				schema: {
					tags: ["partners"],
					summary: "Assign supervisors to partner",
					operationId: "assignPartnerSupervisor",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						partnerId: z.uuid(),
					}),
					body: assignSupervisorBodySchema,
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, partnerId } = request.params;
				const supervisorIds = Array.isArray(request.body.supervisorIds)
					? request.body.supervisorIds
					: request.body.supervisorId
						? [request.body.supervisorId]
						: [];

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

				const uniqueSupervisorIds = await assertSupervisorUserIds(
					organization.id,
					supervisorIds,
				);

				await replacePartnerSupervisors({
					organizationId: organization.id,
					partnerId,
					supervisorIds: uniqueSupervisorIds,
				});

				return reply.status(204).send();
			},
		);
}
