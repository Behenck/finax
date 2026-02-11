import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "@/lib/prisma";

export async function createInviteLink(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post("/organizations/:slug/invites/link", {
      schema: {
        tags: ["invites"],
        summary: "Generate an invite link for an organization",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        response: {
          201: z.object({
            url: z.url(),
            expiresAt: z.string().nullable(),
          }),
        },
      },
    }, async (request, reply) => {
      const { slug } = request.params;
      const userId = await request.getCurrentUserId();
      const { membership, organization } = await request.getUserMembership(slug);

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) //24h

      const invite = await prisma.invite.create({
        data: {
          organizationId: organization.id,
          authorId: userId,
          role: "MEMBER",
          type: "LINK",
          expiresAt,
        },
        select: {
          id: true,
          expiresAt: true,
        },
      });

      const appUrl = process.env.APP_WEB_URL;
      const url = `${appUrl}/invite/${invite.id}`;

      return reply.status(201).send({
        url,
        expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
      });
    });
}
