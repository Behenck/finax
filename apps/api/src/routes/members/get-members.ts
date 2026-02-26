import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod'

import { auth } from '@/middleware/auth'
import { prisma } from '@/lib/prisma'
import { Role } from 'generated/prisma/enums'

export async function getMembers(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/organizations/:slug/members',
      {
        schema: {
          tags: ['members'],
          summary: 'Get all organization members',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
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
                  accesses: z.array(
                    z.object({
                      companyId: z.uuid(),
                      companyName: z.string(),
                      unitId: z.uuid().nullable(),
                      unitName: z.string().nullable(),
                    }),
                  ),
                }),
              ),
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params
        const userId = await request.getCurrentUserId()
        const { membership, organization } =
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
            memberCompanyAccesses: {
              select: {
                companyId: true,
                unitId: true,
                company: {
                  select: {
                    name: true,
                  },
                },
                unit: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          where: { organizationId: organization.id },
          orderBy: {
            role: 'asc',
          },
        })

        const membersWithRoles = members.map(
          ({ user: { id: userId, ...user }, memberCompanyAccesses, ...member }) => {
            return {
              ...user,
              ...member,
              userId,
              accesses: memberCompanyAccesses.map((access) => ({
                companyId: access.companyId,
                companyName: access.company.name,
                unitId: access.unitId,
                unitName: access.unit?.name ?? null,
              })),
            }
          },
        )

        return reply.send({
          members: membersWithRoles,
        })
      },
    )
}
