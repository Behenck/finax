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
import {
	MemberDataScope,
	PartnerDocumentType,
	PartnerStatus,
	SaleResponsibleType,
	SaleStatus,
} from "generated/prisma/enums";

const PARTNER_LIST_SALE_STATUSES = [
	SaleStatus.PENDING,
	SaleStatus.COMPLETED,
] as const;

function createUtcDate(year: number, monthIndex: number, day: number) {
	return new Date(Date.UTC(year, monthIndex, day));
}

function getCurrentUtcMonthRange(referenceDate = new Date()) {
	const start = createUtcDate(
		referenceDate.getUTCFullYear(),
		referenceDate.getUTCMonth(),
		1,
	);
	const end = createUtcDate(
		referenceDate.getUTCFullYear(),
		referenceDate.getUTCMonth() + 1,
		1,
	);

	return { start, end };
}

export async function getPartners(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/partners",
			{
				schema: {
					tags: ["partners"],
					summary: "Get partners",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					response: {
						200: z.object({
							partners: z.array(
								z.object({
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
									currentMonthSalesAmount: z.number().int().nonnegative(),
									currentMonthSalesCount: z.number().int().nonnegative(),
								}),
							),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
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

				const partners = await prisma.partner.findMany({
					where: {
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
						organization: {
							select: {
								slug: true,
							},
						},
						status: true,
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
				const partnerIds = partners.map((partner) => partner.id);
				const currentMonthSalesByPartnerId = new Map<
					string,
					{
						amount: number;
						count: number;
					}
				>();

				if (canViewSales && partnerIds.length > 0) {
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
					const salesVisibilityWhere =
						buildSalesVisibilityWhere(visibilityContext);
					const currentMonthRange = getCurrentUtcMonthRange();
					const currentMonthSalesWhere: Prisma.SaleWhereInput = {
						AND: [
							{
								organizationId: organization.id,
								status: {
									in: [...PARTNER_LIST_SALE_STATUSES],
								},
								responsibleType: SaleResponsibleType.PARTNER,
								responsibleId: {
									in: partnerIds,
								},
								saleDate: {
									gte: currentMonthRange.start,
									lt: currentMonthRange.end,
								},
							},
							...(salesVisibilityWhere ? [salesVisibilityWhere] : []),
						],
					};
					const currentMonthSalesRows = await prisma.sale.groupBy({
						by: ["responsibleId"],
						where: currentMonthSalesWhere,
						_count: {
							_all: true,
						},
						_sum: {
							totalAmount: true,
						},
					});

					for (const row of currentMonthSalesRows) {
						if (!row.responsibleId) {
							continue;
						}

						currentMonthSalesByPartnerId.set(row.responsibleId, {
							amount: row._sum.totalAmount ?? 0,
							count: row._count._all,
						});
					}
				}

				return {
					partners: partners.map((partner) => {
						const supervisors = partner.supervisors.map(
							(link) => link.supervisor,
						);
						const currentMonthSales = currentMonthSalesByPartnerId.get(
							partner.id,
						);

						return {
							...partner,
							supervisor: supervisors[0] ?? null,
							supervisors,
							currentMonthSalesAmount: currentMonthSales?.amount ?? 0,
							currentMonthSalesCount: currentMonthSales?.count ?? 0,
						};
					}),
				};
			},
		);
}
