import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import { MemberDataScope } from "generated/prisma/enums";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import {
	buildSalesVisibilityWhere,
	loadMemberDataVisibilityContext,
} from "@/permissions/data-visibility";
import { BadRequestError } from "../_errors/bad-request-error";
import { SaleHistoryEventSchema } from "./sale-schemas";

function parseHistoryChanges(value: Prisma.JsonValue) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((item) => {
		if (!item || typeof item !== "object" || Array.isArray(item)) {
			return [];
		}

		const change = item as Record<string, unknown>;
		if (typeof change.path !== "string") {
			return [];
		}

		return [
			{
				path: change.path,
				before: (change.before ?? null) as unknown,
				after: (change.after ?? null) as unknown,
			},
		];
	});
}

export async function getSaleHistory(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/sales/:saleId/history",
			{
				schema: {
					tags: ["sales"],
					summary: "Get sale history",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
					}),
					response: {
						200: z.object({
							history: z.array(SaleHistoryEventSchema),
						}),
					},
				},
			},
			async (request) => {
				const { slug, saleId } = request.params;
				const { organization, membership } =
					await request.getUserMembership(slug);
				const canViewAllSales = await request.hasPermission(
					slug,
					"sales.view.all",
				);
				const visibilityContext = await loadMemberDataVisibilityContext({
					organizationId: organization.id,
					memberId: membership.id,
					userId: membership.userId,
					role: membership.role,
					customersScope: membership.customersScope,
					salesScope: canViewAllSales
						? MemberDataScope.ORGANIZATION_ALL
						: MemberDataScope.LINKED_ONLY,
					commissionsScope: membership.commissionsScope,
				});
				const salesVisibilityWhere =
					buildSalesVisibilityWhere(visibilityContext);
				const saleWhere: Prisma.SaleWhereInput = salesVisibilityWhere
					? {
							AND: [
								{
									id: saleId,
									organizationId: organization.id,
								},
								salesVisibilityWhere,
							],
						}
					: {
							id: saleId,
							organizationId: organization.id,
						};

				const sale = await prisma.sale.findFirst({
					where: saleWhere,
					select: {
						id: true,
					},
				});

				if (!sale) {
					throw new BadRequestError("Sale not found");
				}

				const events = await prisma.saleHistoryEvent.findMany({
					where: {
						saleId,
						organizationId: organization.id,
					},
					orderBy: {
						createdAt: "desc",
					},
					select: {
						id: true,
						action: true,
						createdAt: true,
						changes: true,
						actor: {
							select: {
								id: true,
								name: true,
								avatarUrl: true,
							},
						},
					},
				});

				return {
					history: events.map((event) => ({
						id: event.id,
						action: event.action,
						createdAt: event.createdAt,
						actor: event.actor,
						changes: parseHistoryChanges(event.changes),
					})),
				};
			},
		);
}
