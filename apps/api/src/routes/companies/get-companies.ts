import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { unitResponseSchema } from "../units/unit-schemas";

export async function getCompanies(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/companies",
			{
				schema: {
					tags: ["companies"],
					summary: "Get companies",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					response: {
						200: z.object({
							companies: z.array(
								z.object({
									id: z.uuid(),
									name: z.string(),
									cnpj: z.string().nullable(),
									units: z.array(unitResponseSchema),
									employees: z.array(
										z.object({
											id: z.uuid(),
											name: z.string(),
											department: z.string().nullable(),
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
				const canViewAllCompanies = await request.hasPermission(
					slug,
					"registers.companies.view",
				);
				const memberCompanyAccesses = !canViewAllCompanies
					? await prisma.memberCompanyAccess.findMany({
							where: {
								memberId: membership.id,
								organizationId: organization.id,
							},
							select: {
								companyId: true,
								unitId: true,
							},
						})
					: [];
				const restrictedCompanyIds = Array.from(
					new Set(
						memberCompanyAccesses.map((memberCompanyAccess) =>
							memberCompanyAccess.companyId,
						),
					),
				);
				const shouldRestrictByMemberAccess = !canViewAllCompanies;

				if (shouldRestrictByMemberAccess && restrictedCompanyIds.length === 0) {
					return {
						companies: [],
					};
				}

				const companies = await prisma.company.findMany({
					where: {
						organizationId: organization.id,
						...(shouldRestrictByMemberAccess
							? {
									id: {
										in: restrictedCompanyIds,
									},
								}
							: {}),
					},
					select: {
						id: true,
						name: true,
						cnpj: true,
						units: {
							select: {
								id: true,
								name: true,
								cnpj: true,
								country: true,
								state: true,
								city: true,
								street: true,
								zipCode: true,
								neighborhood: true,
								number: true,
								complement: true,
							},
						},
						employees: {
							select: {
								id: true,
								name: true,
								department: true,
							},
						},
					},
				});

				if (!shouldRestrictByMemberAccess) {
					return { companies };
				}

				const accessByCompanyId = new Map<
					string,
					{
						hasCompanyWideAccess: boolean;
						unitIds: Set<string>;
					}
				>();

				for (const memberCompanyAccess of memberCompanyAccesses) {
					const currentAccess = accessByCompanyId.get(
						memberCompanyAccess.companyId,
					) ?? {
						hasCompanyWideAccess: false,
						unitIds: new Set<string>(),
					};

					if (memberCompanyAccess.unitId === null) {
						currentAccess.hasCompanyWideAccess = true;
					} else {
						currentAccess.unitIds.add(memberCompanyAccess.unitId);
					}

					accessByCompanyId.set(memberCompanyAccess.companyId, currentAccess);
				}

				const scopedCompanies = companies
					.filter((company) => accessByCompanyId.has(company.id))
					.map((company) => {
						const companyAccess = accessByCompanyId.get(company.id);
						if (!companyAccess) {
							return null;
						}

						if (companyAccess.hasCompanyWideAccess) {
							return company;
						}

						return {
							...company,
							units: company.units.filter((unit) =>
								companyAccess.unitIds.has(unit.id),
							),
						};
					})
					.filter(
						(
							company,
						): company is (typeof companies)[number] => company !== null,
					);

				return { companies: scopedCompanies };
			},
		);
}
