import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { SaleCommissionInstallmentStatus } from "generated/prisma/enums";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import {
	buildBonusInstallmentsBeneficiaryVisibilityWhere,
	loadMemberDataVisibilityContext,
} from "@/permissions/data-visibility";
import { BadRequestError } from "../_errors/bad-request-error";
import { parseSaleDateInput, PatchBonusInstallmentStatusBodySchema } from "./sale-schemas";

function getCurrentDateUtc() {
	const now = new Date();
	return new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
}

export async function patchBonusInstallmentStatus(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.patch(
			"/organizations/:slug/commissions/bonus-installments/:installmentId/status",
			{
				schema: {
					tags: ["sales"],
					summary: "Update bonus installment status",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						installmentId: z.uuid(),
					}),
					body: PatchBonusInstallmentStatusBodySchema,
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, installmentId } = request.params;
				const { status, paymentDate } = request.body;
				const { organization, membership } = await request.getUserMembership(slug);
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
					commissionsScope: membership.commissionsScope,
				});
				const bonusVisibilityWhere = canViewAllCommissions
					? undefined
					: buildBonusInstallmentsBeneficiaryVisibilityWhere(visibilityContext);

				const installment = await prisma.bonusInstallment.findFirst({
					where: {
						id: installmentId,
						organizationId: organization.id,
						...(bonusVisibilityWhere ?? {}),
					},
					select: {
						id: true,
						status: true,
					},
				});

				if (!installment) {
					throw new BadRequestError("Bonus installment not found");
				}

				if (installment.status !== SaleCommissionInstallmentStatus.PENDING) {
					throw new BadRequestError(
						"Only pending bonus installments can change status",
					);
				}

				await prisma.bonusInstallment.update({
					where: {
						id: installment.id,
					},
					data: {
						status,
						amount: status === "CANCELED" ? 0 : undefined,
						paymentDate: paymentDate
							? parseSaleDateInput(paymentDate)
							: getCurrentDateUtc(),
					},
				});

				return reply.status(204).send();
			},
		);
}
