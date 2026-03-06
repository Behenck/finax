import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { EmployeePixKeyType, Role } from "generated/prisma/enums";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";

export async function getEmployees(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/employees",
			{
				schema: {
					tags: ["employees"],
					summary: "Get employees",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					response: {
						200: z.object({
							employees: z.array(
								z.object({
									id: z.uuid(),
									name: z.string(),
									role: z.string().nullable(),
									email: z.string(),
									phone: z.string().nullable(),
									department: z.string().nullable(),
									cpf: z.string().nullable(),
									pixKeyType: z.enum(EmployeePixKeyType).nullable(),
									pixKey: z.string().nullable(),
									paymentNotes: z.string().nullable(),
									country: z.string().nullable(),
									state: z.string().nullable(),
									city: z.string().nullable(),
									street: z.string().nullable(),
									zipCode: z.string().nullable(),
									neighborhood: z.string().nullable(),
									number: z.string().nullable(),
									complement: z.string().nullable(),
									userId: z.uuid().nullable(),
									linkedUser: z
										.object({
											id: z.uuid(),
											name: z.string().nullable(),
											email: z.string(),
											avatarUrl: z.string().nullable(),
											membership: z
												.object({
													id: z.uuid(),
													role: z.enum(Role),
													accesses: z.array(
														z.object({
															companyId: z.uuid(),
															companyName: z.string(),
															unitId: z.uuid().nullable(),
															unitName: z.string().nullable(),
														}),
													),
												})
												.nullable(),
										})
										.nullable(),
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
								}),
							),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;

				const organization = await prisma.organization.findUnique({
					where: {
						slug,
					},
					select: {
						id: true,
					},
				});

				if (!organization) {
					throw new BadRequestError("Organization not found");
				}

				const employees = await prisma.employee.findMany({
					where: {
						organizationId: organization.id,
					},
					select: {
						id: true,
						name: true,
						email: true,
						phone: true,
						role: true,
						department: true,
						cpf: true,
						pixKeyType: true,
						pixKey: true,
						paymentNotes: true,
						country: true,
						state: true,
						city: true,
						street: true,
						zipCode: true,
						neighborhood: true,
						number: true,
						complement: true,
						userId: true,
						user: {
							select: {
								id: true,
								name: true,
								email: true,
								avatarUrl: true,
								member_on: {
									where: {
										organizationId: organization.id,
									},
									select: {
										id: true,
										role: true,
										memberCompanyAccesses: {
											select: {
												companyId: true,
												unitId: true,
												company: {
													select: {
														name: true,
													},
												},
												unit: {
													select: {
														name: true,
													},
												},
											},
										},
									},
									take: 1,
								},
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
				});

				return {
					employees: employees.map((employee) => {
						const { user, ...rest } = employee;
						const membership = user?.member_on[0];

						return {
							...rest,
							linkedUser: user
								? {
										id: user.id,
										name: user.name,
										email: user.email,
										avatarUrl: user.avatarUrl,
										membership: membership
											? {
													id: membership.id,
													role: membership.role,
													accesses: membership.memberCompanyAccesses.map(
														(access) => ({
															companyId: access.companyId,
															companyName: access.company.name,
															unitId: access.unitId,
															unitName: access.unit?.name ?? null,
														}),
													),
												}
											: null,
									}
								: null,
						};
					}),
				};
			},
		);
}
