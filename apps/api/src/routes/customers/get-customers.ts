import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import {
	CustomerDocumentType,
	CustomerPersonType,
	CustomerStatus,
	MemberDataScope,
} from "generated/prisma/enums";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import {
	buildCustomersVisibilityWhere,
	loadMemberDataVisibilityContext,
} from "@/permissions/data-visibility";
import {
	customerResponsibleTypeValues,
	loadCustomersResponsible,
} from "./customer-responsible";

export async function getCustomers(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/customers",
			{
				schema: {
					tags: ["customers"],
					summary: "Get customers",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					response: {
						200: z.object({
							customers: z.array(
								z.object({
									id: z.uuid(),
									name: z.string(),
									personType: z.enum(CustomerPersonType),
									phone: z.string().nullable(),
									email: z.string().nullable(),
									documentType: z.enum(CustomerDocumentType),
									documentNumber: z.string(),
									status: z.enum(CustomerStatus),
									responsible: z
										.object({
											type: z.enum(customerResponsibleTypeValues),
											id: z.uuid(),
											name: z.string(),
										})
										.nullable(),
									pf: z
										.object({
											birthDate: z.date().nullable(),
											monthlyIncome: z.number().nullable(),
											profession: z.string().nullable(),
											placeOfBirth: z.string().nullable(),
											fatherName: z.string().nullable(),
											motherName: z.string().nullable(),
											naturality: z.string().nullable(),
										})
										.nullable(),
									pj: z
										.object({
											businessActivity: z.string().nullable(),
											municipalRegistration: z.string().nullable(),
											stateRegistration: z.string().nullable(),
											legalName: z.string().nullable(),
											tradeName: z.string().nullable(),
											foundationDate: z.date().nullable(),
										})
										.nullable(),
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
				const canViewAllCustomers = await request.hasPermission(
					slug,
					"registers.customers.view.all",
				);
				const visibilityContext = await loadMemberDataVisibilityContext({
					organizationId: organization.id,
					memberId: membership.id,
					userId: membership.userId,
					role: membership.role,
					customersScope: canViewAllCustomers
						? MemberDataScope.ORGANIZATION_ALL
						: MemberDataScope.LINKED_ONLY,
					salesScope: membership.salesScope,
					commissionsScope: membership.commissionsScope,
				});
				const customersVisibilityWhere = buildCustomersVisibilityWhere({
					organizationId: organization.id,
					context: visibilityContext,
				});
				const customersWhere: Prisma.CustomerWhereInput =
					customersVisibilityWhere
						? {
								AND: [
									{
										organizationId: organization.id,
									},
									customersVisibilityWhere,
								],
							}
						: {
								organizationId: organization.id,
							};

				const customers = await prisma.customer.findMany({
					where: customersWhere,
					select: {
						id: true,
						name: true,
						personType: true,
						email: true,
						phone: true,
						documentType: true,
						documentNumber: true,
						status: true,
						responsibleType: true,
						responsibleId: true,
						customerPF: {
							select: {
								birthDate: true,
								monthlyIncome: true,
								profession: true,
								placeOfBirth: true,
								fatherName: true,
								motherName: true,
								naturality: true,
							},
						},
						customerPJ: {
							select: {
								businessActivity: true,
								municipalRegistration: true,
								stateRegistration: true,
								legalName: true,
								tradeName: true,
								foundationDate: true,
							},
						},
					},
				});

				const responsibleByCustomerId = await loadCustomersResponsible(
					organization.id,
					customers,
				);

				const result = customers.map((customer) => {
					const isPF = customer.personType === CustomerPersonType.PF;
					const isPJ = customer.personType === CustomerPersonType.PJ;

					return {
						id: customer.id,
						name: customer.name,
						personType: customer.personType,
						email: customer.email,
						phone: customer.phone,
						documentType: customer.documentType,
						documentNumber: customer.documentNumber,
						status: customer.status,
						responsible: responsibleByCustomerId.get(customer.id) ?? null,

						pf: isPF
							? customer.customerPF && {
									birthDate: customer.customerPF.birthDate,
									monthlyIncome: customer.customerPF.monthlyIncome,
									profession: customer.customerPF.profession,
									placeOfBirth: customer.customerPF.placeOfBirth,
									fatherName: customer.customerPF.fatherName,
									motherName: customer.customerPF.motherName,
									naturality: customer.customerPF.naturality,
								}
							: null,

						pj: isPJ
							? customer.customerPJ && {
									businessActivity: customer.customerPJ.businessActivity,
									municipalRegistration:
										customer.customerPJ.municipalRegistration,
									stateRegistration: customer.customerPJ.stateRegistration,
									legalName: customer.customerPJ.legalName,
									tradeName: customer.customerPJ.tradeName,
									foundationDate: customer.customerPJ.foundationDate,
								}
							: null,
					};
				});

				return { customers: result };
			},
		);
}
