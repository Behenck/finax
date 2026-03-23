import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";

import { BadRequestError } from "../_errors/bad-request-error";

export async function revokeInvite(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().register(auth).delete(
		"/organizations/:slug/invites/:inviteId",
		{
			schema: {
				tags: ["invites"],
				summary: "Revoke an organization invite",
				security: [{ bearerAuth: [] }],
				params: z.object({
					slug: z.string(),
					inviteId: z.string().uuid(),
				}),
				response: {
					204: z.null(),
				},
			},
		},
		async (request, reply) => {
			const { slug, inviteId } = request.params;
			const { organization } = await request.getUserMembership(slug);

			const invite = await prisma.invite.findFirst({
				where: {
					id: inviteId,
					organizationId: organization.id,
				},
				select: {
					id: true,
				},
			});

			if (!invite) {
				throw new BadRequestError("Invite not found.");
			}

			await prisma.invite.delete({
				where: { id: invite.id },
			});

			return reply.status(204).send();
		},
	);
}
