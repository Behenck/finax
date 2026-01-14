import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod'

import { prisma } from '@/lib/prisma'

import { BadRequestError } from '../_errors/bad-request-error'

export async function acceptInvite(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/invites/:inviteId/accept',
      {
        schema: {
          tags: ['invites'],
          summary: 'Accept an invite',
          params: z.object({
            inviteId: z.uuid(),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { inviteId } = request.params

        const invite = await prisma.invite.findUnique({
          where: { id: inviteId },
        })

        if (!invite) {
          throw new BadRequestError('Invite not found or expired')
        }

        let user = await prisma.user.findUnique({
          where: { email: invite.email },
        })

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: invite.email,
            }
          })
        }

        if (invite.email !== user.email) {
          throw new BadRequestError('This invite belongs to another user.')
        }

        await prisma.$transaction([
          prisma.member.create({
            data: {
              userId: user.id,
              organizationId: invite.organizationId,
              role: invite.role,
            },
          }),

          prisma.invite.delete({
            where: { id: invite.id },
          }),
        ])

        return reply.status(204).send()
      },
    )
}