import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { auth } from "@/middleware/auth";
import {
	buildBonusInstallmentsBeneficiaryVisibilityWhere,
	buildCommissionInstallmentsVisibilityWhere,
	loadMemberDataVisibilityContext,
} from "@/permissions/data-visibility";
import { MemberDataScope } from "generated/prisma/enums";
import { BadRequestError } from "../_errors/bad-request-error";
import { loadOrganizationCommissionInstallments } from "./sale-commissions";
import {
	GetOrganizationCommissionInstallmentsQuerySchema,
	OrganizationCommissionInstallmentsResponseSchema,
	parseSaleDateInput,
} from "./sale-schemas";

export async function getOrganizationCommissionInstallments(
	app: FastifyInstance,
) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/commissions/installments",
			{
				schema: {
					tags: ["sales"],
					summary: "Get organization commission installments",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					querystring: GetOrganizationCommissionInstallmentsQuerySchema,
					response: {
						200: OrganizationCommissionInstallmentsResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const {
					page,
					pageSize,
					q,
					companyId,
					unitId,
					productId,
					direction,
					status,
					expectedFrom,
					expectedTo,
				} = request.query;

				const { organization, membership } =
					await request.getUserMembership(slug);
				const canViewAllCommissions = await request.hasPermission(
					slug,
					"sales.commissions.view.all",
				);
				const visibilityContext = await loadMemberDataVisibilityContext({
					organizationId: organization.id,
					memberId: membership.id,
					userId: membership.userId,
					customersScope: membership.customersScope,
					salesScope: membership.salesScope,
					commissionsScope: canViewAllCommissions
						? MemberDataScope.ORGANIZATION_ALL
						: MemberDataScope.LINKED_ONLY,
				});
				const visibilityWhere =
					buildCommissionInstallmentsVisibilityWhere(visibilityContext);
				const bonusVisibilityWhere = canViewAllCommissions
					? undefined
					: buildBonusInstallmentsBeneficiaryVisibilityWhere(visibilityContext);

				const expectedFromDate = expectedFrom
					? parseSaleDateInput(expectedFrom)
					: undefined;
				const expectedToDate = expectedTo
					? parseSaleDateInput(expectedTo)
					: undefined;

				if (
					expectedFromDate &&
					expectedToDate &&
					expectedFromDate > expectedToDate
				) {
					throw new BadRequestError(
						"expectedFrom must be less than or equal to expectedTo",
					);
				}

				return loadOrganizationCommissionInstallments({
					organizationId: organization.id,
					page,
					pageSize,
					q,
					companyId,
					unitId,
					productId,
					direction,
					status,
					expectedFrom: expectedFromDate,
					expectedTo: expectedToDate,
					visibilityWhere,
					bonusVisibilityWhere,
				});
			},
		);
}
