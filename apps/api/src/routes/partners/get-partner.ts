import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import {
	buildPartnersVisibilityWhere,
	buildSalesVisibilityWhere,
	loadMemberDataVisibilityContext,
} from "@/permissions/data-visibility";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	MemberDataScope,
	PartnerDocumentType,
	PartnerStatus,
	SaleResponsibleType,
	SaleStatus,
} from "generated/prisma/enums";
import {
	loadOpenSaleDelinquenciesBySaleIds,
	loadSaleDelinquencySummaryBySaleIds,
} from "../sales/sale-delinquencies";
import { loadSalesResponsible } from "../sales/sale-responsible";
import { SaleResponsiblePayloadSchema } from "../sales/sale-schemas";

export async function getPartner(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/partners/:partnerId",
			{
				schema: {
					tags: ["partners"],
					summary: "Get partner",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						partnerId: z.uuid(),
					}),
					response: {
						200: z.object({
							partner: z.object({
								id: z.uuid(),
								name: z.string().nullable(),
								email: z.string().nullable(),
								phone: z.string().nullable(),
								companyName: z.string(),
								documentType: z.enum(PartnerDocumentType).nullable(),
								document: z.string().nullable(),
								country: z.string(),
								state: z.string(),
								city: z.string().nullable(),
								street: z.string().nullable(),
								zipCode: z.string().nullable(),
								neighborhood: z.string().nullable(),
								number: z.string().nullable(),
								complement: z.string().nullable(),
								organization: z.object({
									slug: z.string(),
								}),
								status: z.enum(PartnerStatus),
								user: z
									.object({
										id: z.uuid(),
										name: z.string().nullable(),
									})
									.nullable(),
								supervisor: z
									.object({
										id: z.uuid(),
										name: z.string().nullable(),
									})
									.nullable(),
								supervisors: z.array(
									z.object({
										id: z.uuid(),
										name: z.string().nullable(),
									}),
								),
								sales: z.array(
									z.object({
										id: z.uuid(),
										saleDate: z.date(),
										totalAmount: z.number().int(),
										status: z.enum(SaleStatus),
										createdAt: z.date(),
										updatedAt: z.date(),
										customer: z.object({
											id: z.uuid(),
											name: z.string(),
										}),
										product: z.object({
											id: z.uuid(),
											name: z.string(),
										}),
										company: z.object({
											id: z.uuid(),
											name: z.string(),
										}),
										unit: z
											.object({
												id: z.uuid(),
												name: z.string(),
											})
											.nullable(),
										responsible: SaleResponsiblePayloadSchema.nullable(),
										delinquencySummary: z.object({
											hasOpen: z.boolean(),
											openCount: z.number().int().nonnegative(),
											oldestDueDate: z.date().nullable(),
											latestDueDate: z.date().nullable(),
										}),
										openDelinquencies: z.array(
											z.object({
												id: z.uuid(),
												dueDate: z.date(),
												resolvedAt: z.date().nullable(),
												createdAt: z.date(),
												updatedAt: z.date(),
												createdBy: z.object({
													id: z.uuid(),
													name: z.string().nullable(),
													avatarUrl: z.string().nullable(),
												}),
												resolvedBy: z
													.object({
														id: z.uuid(),
														name: z.string().nullable(),
														avatarUrl: z.string().nullable(),
													})
													.nullable(),
											}),
										),
									}),
								),
							}),
						}),
					},
				},
			},
			async (request) => {
				const { slug, partnerId } = request.params;
				const { organization, membership } =
					await request.getUserMembership(slug);
				const canViewAllPartners = await request.hasPermission(
					slug,
					"registers.partners.view.all",
				);
				const canViewSales = await request.hasPermission(slug, "sales.view");
				const canViewAllSales = canViewSales
					? await request.hasPermission(slug, "sales.view.all")
					: false;
				const partnersVisibilityWhere = buildPartnersVisibilityWhere({
					userId: membership.userId,
					partnersScope: canViewAllPartners
						? MemberDataScope.ORGANIZATION_ALL
						: MemberDataScope.LINKED_ONLY,
				});

				const partner = await prisma.partner.findFirst({
					where: {
						id: partnerId,
						organizationId: organization.id,
						...partnersVisibilityWhere,
					},
					select: {
						id: true,
						name: true,
						email: true,
						phone: true,
						companyName: true,
						documentType: true,
						document: true,
						country: true,
						state: true,
						city: true,
						street: true,
						zipCode: true,
						neighborhood: true,
						number: true,
						complement: true,
						status: true,
						organization: {
							select: {
								slug: true,
							},
						},
						user: {
							select: {
								id: true,
								name: true,
							},
						},
						supervisors: {
							select: {
								supervisor: {
									select: {
										id: true,
										name: true,
									},
								},
							},
						},
					},
				});

				if (!partner) {
					throw new BadRequestError("Partner not found");
				}

				const visibilityContext = await loadMemberDataVisibilityContext({
					organizationId: organization.id,
					memberId: membership.id,
					userId: membership.userId,
					role: membership.role,
					customersScope: membership.customersScope,
					salesScope: canViewAllSales
						? MemberDataScope.ORGANIZATION_ALL
						: membership.salesScope,
					commissionsScope: membership.commissionsScope,
					partnersScope: canViewAllPartners
						? MemberDataScope.ORGANIZATION_ALL
						: membership.partnersScope,
				});
				const salesVisibilityWhere = canViewSales
					? buildSalesVisibilityWhere(visibilityContext)
					: undefined;
				const partnerSalesWhere: Prisma.SaleWhereInput = salesVisibilityWhere
					? {
							AND: [
								{
									organizationId: organization.id,
									responsibleType: SaleResponsibleType.PARTNER,
									responsibleId: partner.id,
								},
								salesVisibilityWhere,
							],
						}
					: {
							organizationId: organization.id,
							responsibleType: SaleResponsibleType.PARTNER,
							responsibleId: partner.id,
						};
				const partnerSales = canViewSales
					? await prisma.sale.findMany({
							where: partnerSalesWhere,
							orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
							select: {
								id: true,
								saleDate: true,
								totalAmount: true,
								status: true,
								createdAt: true,
								updatedAt: true,
								responsibleType: true,
								responsibleId: true,
								responsibleLabel: true,
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
							},
						})
					: [];
				const partnerSaleIds = partnerSales.map((sale) => sale.id);
				const [
					responsibleBySaleId,
					delinquencySummaryBySaleId,
					openDelinquenciesBySaleId,
				] = await Promise.all([
					loadSalesResponsible(organization.id, partnerSales),
					loadSaleDelinquencySummaryBySaleIds(
						prisma,
						organization.id,
						partnerSaleIds,
					),
					loadOpenSaleDelinquenciesBySaleIds(
						prisma,
						organization.id,
						partnerSaleIds,
					),
				]);

				return {
					partner: {
						...partner,
						supervisor:
							partner.supervisors.map((link) => link.supervisor)[0] ?? null,
						supervisors: partner.supervisors.map((link) => link.supervisor),
						sales: partnerSales.map((sale) => ({
							id: sale.id,
							saleDate: sale.saleDate,
							totalAmount: sale.totalAmount,
							status: sale.status,
							createdAt: sale.createdAt,
							updatedAt: sale.updatedAt,
							customer: sale.customer,
							product: sale.product,
							company: sale.company,
							unit: sale.unit,
							responsible: responsibleBySaleId.get(sale.id) ?? null,
							delinquencySummary: delinquencySummaryBySaleId.get(sale.id) ?? {
								hasOpen: false,
								openCount: 0,
								oldestDueDate: null,
								latestDueDate: null,
							},
							openDelinquencies: openDelinquenciesBySaleId.get(sale.id) ?? [],
						})),
					},
				};
			},
		);
}
