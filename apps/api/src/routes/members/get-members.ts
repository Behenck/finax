import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod'

import { auth } from '@/middleware/auth'
import { prisma } from '@/lib/prisma'
import { MemberDataScope, Role } from 'generated/prisma/enums'

function isMissingMemberDataScopeColumnError(error: unknown) {
	if (!error || typeof error !== 'object') {
		return false
	}

	const code = 'code' in error ? (error as { code?: unknown }).code : undefined
	if (code === 'P2022') {
		return true
	}

	const message =
		'message' in error ? (error as { message?: unknown }).message : undefined
	if (typeof message !== 'string') {
		return false
	}

	return (
		message.includes('does not exist in the current database') ||
		/type\s+"(?:public\.)?MemberDataScope"\s+does not exist/i.test(message)
	)
}

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
                  customersScope: z.enum(MemberDataScope),
                  salesScope: z.enum(MemberDataScope),
                  commissionsScope: z.enum(MemberDataScope),
                  partnersScope: z.enum(MemberDataScope),
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

        const memberBaseSelect = {
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
        } as const

        const where = { organizationId: organization.id }
        const orderBy = { role: 'asc' as const }

        let members: Array<{
          id: string
          role: (typeof Role)[keyof typeof Role]
          customersScope: (typeof MemberDataScope)[keyof typeof MemberDataScope]
          salesScope: (typeof MemberDataScope)[keyof typeof MemberDataScope]
          commissionsScope: (typeof MemberDataScope)[keyof typeof MemberDataScope]
          partnersScope: (typeof MemberDataScope)[keyof typeof MemberDataScope]
          user: {
            id: string
            name: string | null
            email: string
            avatarUrl: string | null
          }
          memberCompanyAccesses: Array<{
            companyId: string
            unitId: string | null
            company: {
              name: string
            }
            unit: {
              name: string
            } | null
          }>
        }>

        try {
          const membersWithScopes = await prisma.member.findMany({
            select: {
              ...memberBaseSelect,
              customersScope: true,
              salesScope: true,
              commissionsScope: true,
              partnersScope: true,
            },
            where,
            orderBy,
          })

          members = membersWithScopes
        } catch (error) {
          if (!isMissingMemberDataScopeColumnError(error)) {
            throw error
          }

          const legacyMembers = await prisma.member.findMany({
            select: memberBaseSelect,
            where,
            orderBy,
          })

          members = legacyMembers.map((member) => ({
            ...member,
            customersScope: MemberDataScope.ORGANIZATION_ALL,
            salesScope: MemberDataScope.ORGANIZATION_ALL,
            commissionsScope: MemberDataScope.ORGANIZATION_ALL,
            partnersScope: MemberDataScope.ORGANIZATION_ALL,
          }))
        }

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
