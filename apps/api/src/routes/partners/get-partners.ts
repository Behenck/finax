import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { buildPartnersVisibilityWhere } from "@/permissions/data-visibility";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import {
	MemberDataScope,
	PartnerDocumentType,
	PartnerStatus,
} from "generated/prisma/enums";

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
									name: z.string(),
									email: z.string(),
									phone: z.string(),
									companyName: z.string(),
									documentType: z.enum(PartnerDocumentType),
									document: z.string(),
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
									supervisors: z.array(
										z.object({
											id: z.uuid(),
											name: z.string().nullable(),
										}),
									),
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

				return {
					partners: partners.map((partner) => ({
						...partner,
						supervisors: partner.supervisors.map((link) => link.supervisor),
					})),
				};
			},
		);
}
