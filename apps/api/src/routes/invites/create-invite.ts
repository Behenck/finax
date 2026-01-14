import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { UnauthorizedError } from "../_errors/unauthorized-error";
import { BadRequestError } from "../_errors/bad-request-error";
import { prisma } from "@/lib/prisma";
import { roleSchema } from "@/schemas/role";

export async function createInvite(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post("/organizations/:slug/invites", {
      schema: {
        tags: ["invites"],
        summary: "Create an invite for an organization",
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string()
        }),
        body: z.object({
          email: z.email(),
          role: roleSchema
        }),
        response: {
          201: z.object({
            inviteId: z.uuid()
          })
        }
      }
    },
      async (request, reply) => {
        const { slug } = request.params;
        const userId = await request.getCurrentUserId()
        const { membership, organization } = await request.getUserMembership(slug)

        const { email, role } = request.body;

        const [, domain] = email.split('@')

        if (
          organization.shouldAttachUserByDomain &&
          organization.domain === domain
        ) {
          throw new BadRequestError(`Usuários com o domínio ${domain} entrarão automaticamente na sua organização ao fazer login.`)
        }

        const inviteWithSameEmail = await prisma.invite.findUnique({
          where: {
            email_organizationId: {
              email,
              organizationId: organization.id
            }
          }
        })

        if (inviteWithSameEmail) {
          throw new BadRequestError(
            'Já existe um convite ativo para este e-mail.',
          )
        }

        const memberWithSameEmail = await prisma.member.findFirst({
          where: {
            organizationId: organization.id,
            user: {
              email
            }
          }
        })

        if (memberWithSameEmail) {
          throw new BadRequestError(
            'Já existe um membro com este e-mail na sua organização.',
          )
        }

        const invite = await prisma.invite.create({
          data: {
            organizationId: organization.id,
            email,
            role,
            authorId: userId
          }
        })

        return reply.status(201).send({
          inviteId: invite.id
        })
      }
    )
}