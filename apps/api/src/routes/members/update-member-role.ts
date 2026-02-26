import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod'

import { auth } from '@/middleware/auth'
import { prisma } from '@/lib/prisma'
import { Role } from 'generated/prisma/enums'

export async function updateMemberRole(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/organizations/:slug/members/:memberId/role',
      {
        schema: {
          tags: ['members'],
          summary: 'Update a member role',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            memberId: z.uuid(),
          }),
          body: z.object({
            role: z.enum(Role),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { slug, memberId } = request.params
        const { organization } = await request.getUserMembership(slug)
        const { role } = request.body

        await prisma.member.update({
          where: {
            id: memberId,
            organizationId: organization.id,
          },
          data: {
            role,
          },
        })

        return reply.status(204).send()
      },
    )
}

