import { FastifyInstance } from 'fastify'
import fastifyPlugin from 'fastify-plugin'

import { prisma } from '@/lib/prisma'
import {
	getRequestEffectivePermissions,
	hasRequestPermission,
	requireRequestPermission,
} from "@/permissions/request";
import type { PermissionKey } from "@/permissions/catalog";
import { MemberDataScope } from "generated/prisma/enums";
import { UnauthorizedError } from '@/routes/_errors/unauthorized-error'

function isMissingMemberDataScopeColumnError(error: unknown) {
	if (!error || typeof error !== "object") {
		return false;
	}

	const code = "code" in error ? (error as { code?: unknown }).code : undefined;
	if (code === "P2022") {
		return true;
	}

	const message =
		"message" in error ? (error as { message?: unknown }).message : undefined;
	if (typeof message !== "string") {
		return false;
	}

	return (
		message.includes("does not exist in the current database") ||
		/type\s+"(?:public\.)?MemberDataScope"\s+does not exist/i.test(message)
	);
}

export const auth = fastifyPlugin(async (app: FastifyInstance) => {
  app.addHook('preHandler', async (request) => {
    request.getCurrentUserId = async () => {
      try {
        const { sub } = await request.jwtVerify<{ sub: string }>()

        return sub
      } catch {
        throw new UnauthorizedError('Invalid auth token')
      }
    }

    request.getUserMembership = async (slug: string) => {
      const userId = await request.getCurrentUserId()

			const where = {
				userId,
				organization: {
					slug,
				},
			};

			try {
				const member = await prisma.member.findFirst({
					where,
					select: {
						id: true,
						role: true,
						organizationId: true,
						userId: true,
						customersScope: true,
						salesScope: true,
						commissionsScope: true,
						partnersScope: true,
						organization: true,
					},
				});

				if (!member) {
					throw new UnauthorizedError("You're not a member of this organization.");
				}

				const { organization, ...membership } = member;

				return {
					organization,
					membership,
				};
			} catch (error) {
				if (!isMissingMemberDataScopeColumnError(error)) {
					throw error;
				}

				const legacyMember = await prisma.member.findFirst({
					where,
					select: {
						id: true,
						role: true,
						organizationId: true,
						userId: true,
						organization: true,
					},
				});

				if (!legacyMember) {
					throw new UnauthorizedError("You're not a member of this organization.");
				}

				return {
					organization: legacyMember.organization,
					membership: {
						...legacyMember,
						customersScope: MemberDataScope.ORGANIZATION_ALL,
						salesScope: MemberDataScope.ORGANIZATION_ALL,
						commissionsScope: MemberDataScope.ORGANIZATION_ALL,
						partnersScope: MemberDataScope.ORGANIZATION_ALL,
					},
				};
			}
    }

		request.getEffectivePermissions = async (slug: string) => {
			return getRequestEffectivePermissions(request, slug);
		};

		request.hasPermission = async (
			slug: string,
			permissionKey: PermissionKey | string,
		) => {
			return hasRequestPermission(request, slug, permissionKey);
		};

		request.requirePermission = async (
			slug: string,
			permissionKey: PermissionKey | string,
		) => {
			await requireRequestPermission(request, slug, permissionKey);
		};
  })
})
