import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { buildPartnersVisibilityWhere } from "@/permissions/data-visibility";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	MemberDataScope,
	PartnerDocumentType,
	PartnerStatus,
} from "generated/prisma/enums";

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

				return {
					partner: {
						...partner,
						supervisor:
							partner.supervisors.map((link) => link.supervisor)[0] ?? null,
						supervisors: partner.supervisors.map((link) => link.supervisor),
					},
				};
			},
		);
}
