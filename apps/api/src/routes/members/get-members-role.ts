import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod'

import { auth } from '@/middleware/auth'
import { prisma } from '@/lib/prisma'

import { Role } from 'generated/prisma/enums'

export async function getMembersRole(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/organizations/:slug/members/:role',
      {
        schema: {
          tags: ['members'],
          summary: 'Get all organization members with role',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            role: z.enum(Role),
          }),
          response: {
            200: z.object({
              members: z.array(
                z.object({
                  id: z.uuid(),
                  userId: z.uuid(),
                  role: z.enum(Role),
                  name: z.string().nullable(),
                  avatarUrl: z.url().nullable(),
                  email: z.email(),
                }),
              ),
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug, role } = request.params
        const { organization } =
          await request.getUserMembership(slug)

        const members = await prisma.member.findMany({
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          where: { organizationId: organization.id, role },
          orderBy: {
            role: 'asc',
          },
        })

        const membersWithRoles = members.map(
          ({ user: { id: userId, ...user }, ...member }) => {
            return {
              ...user,
              ...member,
              userId,
            }
          },
        )

        return reply.send({
          members: membersWithRoles,
        })
      },
    )
}