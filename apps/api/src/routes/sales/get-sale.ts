import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import { MemberDataScope } from "generated/prisma/enums";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import {
	buildSaleCommissionsBeneficiaryVisibilityWhere,
	buildSalesVisibilityWhere,
	loadMemberDataVisibilityContext,
} from "@/permissions/data-visibility";
import { BadRequestError } from "../_errors/bad-request-error";
import { loadSaleCommissions } from "./sale-commissions";
import {
	parseSaleDynamicFieldSchemaJson,
	parseSaleDynamicFieldValuesJson,
} from "./sale-dynamic-fields";
import { loadSaleResponsible } from "./sale-responsible";
import { SaleDetailSchema } from "./sale-schemas";

export async function getSale(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/sales/:saleId",
			{
				schema: {
					tags: ["sales"],
					summary: "Get sale",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
					}),
					response: {
						200: z.object({
							sale: SaleDetailSchema,
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
				const canViewAllCommissions = await request.hasPermission(
					slug,
					"sales.commissions.view.all",
				);
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
						organizationId: true,
						companyId: true,
						unitId: true,
						customerId: true,
						productId: true,
						createdById: true,
						saleDate: true,
						totalAmount: true,
						status: true,
						notes: true,
						dynamicFieldSchema: true,
						dynamicFieldValues: true,
						createdAt: true,
						updatedAt: true,
						responsibleType: true,
						responsibleId: true,
						customer: {
							select: {
								id: true,
								name: true,
							},
						},
						product: {
							select: {
								id: true,
								name: true,
							},
						},
						company: {
							select: {
								id: true,
								name: true,
							},
						},
						unit: {
							select: {
								id: true,
								name: true,
							},
						},
						createdBy: {
							select: {
								id: true,
								name: true,
								avatarUrl: true,
							},
						},
					},
				});

				if (!sale) {
					throw new BadRequestError("Sale not found");
				}

				const responsible = await loadSaleResponsible(organization.id, {
					responsibleType: sale.responsibleType,
					responsibleId: sale.responsibleId,
				});
				const commissions = await loadSaleCommissions(
					sale.id,
					organization.id,
					canViewAllCommissions
						? undefined
						: buildSaleCommissionsBeneficiaryVisibilityWhere(visibilityContext),
				);
				const dynamicFieldSchema = parseSaleDynamicFieldSchemaJson(
					sale.dynamicFieldSchema,
				);
				const dynamicFieldValues = parseSaleDynamicFieldValuesJson(
					sale.dynamicFieldValues,
				);

				return {
					sale: {
						id: sale.id,
						organizationId: sale.organizationId,
						companyId: sale.companyId,
						unitId: sale.unitId,
						customerId: sale.customerId,
						productId: sale.productId,
						createdById: sale.createdById,
						saleDate: sale.saleDate,
						totalAmount: sale.totalAmount,
						status: sale.status,
						notes: sale.notes,
						dynamicFieldSchema,
						dynamicFieldValues,
						createdAt: sale.createdAt,
						updatedAt: sale.updatedAt,
						responsibleType: sale.responsibleType,
						responsibleId: sale.responsibleId,
						customer: sale.customer,
						product: sale.product,
						company: sale.company,
						unit: sale.unit,
						createdBy: sale.createdBy,
						responsible,
						commissions,
					},
				};
			},
		);
}
