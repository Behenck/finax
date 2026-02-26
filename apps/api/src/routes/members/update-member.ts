import { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod'

import { auth } from '@/middleware/auth'
import { prisma } from '@/lib/prisma'

import { BadRequestError } from '../_errors/bad-request-error'
import { Role } from 'generated/prisma/enums'

const memberAccessScopeSchema = z.object({
  mode: z.enum(['ALL', 'RESTRICTED']),
  accesses: z
    .array(
      z.object({
        companyId: z.uuid(),
        unitId: z.uuid().nullable().optional(),
      }),
    )
    .default([]),
})

export async function updateMember(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .put(
      '/organizations/:slug/members/:memberId',
      {
        schema: {
          tags: ['members'],
          summary: 'Update a member',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            memberId: z.uuid(),
          }),
          body: z.object({
            role: z.enum(Role),
            accessScope: memberAccessScopeSchema.optional(),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { slug, memberId } = request.params
        const userId = await request.getCurrentUserId()
        const { membership, organization } =
          await request.getUserMembership(slug)

        const { role, accessScope } = request.body

        if (!accessScope) {
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
        }

        const normalizedAccesses =
          accessScope.mode === 'ALL'
            ? []
            : Array.from(
              new Map(
                accessScope.accesses.map((access) => [
                  `${access.companyId}:${access.unitId ?? 'ALL'}`,
                  {
                    companyId: access.companyId,
                    unitId: access.unitId ?? null,
                  },
                ]),
              ).values(),
            )

        const companyIds = [...new Set(normalizedAccesses.map((access) => access.companyId))]
        const unitIds = [
          ...new Set(
            normalizedAccesses
              .map((access) => access.unitId)
              .filter((unitId): unitId is string => !!unitId),
          ),
        ]

        if (companyIds.length > 0) {
          const companies = await prisma.company.findMany({
            where: {
              organizationId: organization.id,
              id: { in: companyIds },
            },
            select: {
              id: true,
              units: unitIds.length
                ? {
                  where: { id: { in: unitIds } },
                  select: { id: true },
                }
                : false,
            },
          })

          if (companies.length !== companyIds.length) {
            throw new BadRequestError('Uma ou mais empresas informadas não pertencem à organização.')
          }

          const companyIdSet = new Set(companies.map((company) => company.id))
          const unitToCompanyMap = new Map<string, string>()

          for (const company of companies) {
            if (Array.isArray(company.units)) {
              for (const unit of company.units) {
                unitToCompanyMap.set(unit.id, company.id)
              }
            }
          }

          for (const access of normalizedAccesses) {
            if (!companyIdSet.has(access.companyId)) {
              throw new BadRequestError('Empresa inválida no escopo de acesso.')
            }

            if (!access.unitId) continue

            const unitCompanyId = unitToCompanyMap.get(access.unitId)

            if (!unitCompanyId || unitCompanyId !== access.companyId) {
              throw new BadRequestError('Unidade inválida para a empresa selecionada.')
            }
          }
        }

        await prisma.$transaction(async (tx) => {
          await tx.member.update({
            where: {
              id: memberId,
              organizationId: organization.id,
            },
            data: { role },
          })

          await tx.memberCompanyAccess.deleteMany({
            where: {
              memberId,
              organizationId: organization.id,
            },
          })

          if (accessScope.mode === 'RESTRICTED' && normalizedAccesses.length > 0) {
            await tx.memberCompanyAccess.createMany({
              data: normalizedAccesses.map((access) => ({
                memberId,
                organizationId: organization.id,
                companyId: access.companyId,
                unitId: access.unitId,
              })),
            })
          }
        })

        return reply.status(204).send()
      },
    )
}
