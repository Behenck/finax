import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { EmployeePixKeyType } from "generated/prisma/enums";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { resolveEmployeeUserIdByEmail } from "./resolve-employee-user-id-by-email";

export async function updateEmployee(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/organizations/:slug/employees/:employeeId",
			{
				schema: {
					tags: ["employees"],
					summary: "Update employee",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						employeeId: z.uuid(),
					}),
					body: z.object({
						name: z.string(),
						role: z.string().optional(),
						email: z.string(),
						phone: z.string().optional(),
						department: z.string().optional(),
						cpf: z.string().optional(),
						pixKeyType: z.enum(EmployeePixKeyType).optional(),
						pixKey: z.string().optional(),
						paymentNotes: z.string().optional(),
						country: z.string().optional(),
						state: z.string().optional(),
						city: z.string().optional(),
						street: z.string().optional(),
						zipCode: z.string().optional(),
						neighborhood: z.string().optional(),
						number: z.string().optional(),
						complement: z.string().optional(),
						companyId: z.uuid(),
						unitId: z.uuid().optional(),
					}),
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, employeeId } = request.params;
				const data = request.body;

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

				const employee = await prisma.employee.findFirst({
					where: {
						id: employeeId,
						organizationId: organization.id,
					},
					select: { id: true },
				});

				if (!employee) {
					throw new BadRequestError("Employee not found");
				}

				const { normalizedEmail, userId } = await resolveEmployeeUserIdByEmail({
					organizationId: organization.id,
					email: data.email,
					excludeEmployeeId: employeeId,
				});

				await db(() =>
					prisma.employee.update({
						where: {
							id: employeeId,
						},
						data: {
							name: data.name,
							role: data.role,
							email: normalizedEmail,
							phone: data.phone,
							department: data.department,
							cpf: data.cpf,
							pixKeyType: data.pixKeyType,
							pixKey: data.pixKey,
							paymentNotes: data.paymentNotes,
							country: data.country,
							state: data.state,
							city: data.city,
							street: data.street,
							zipCode: data.zipCode,
							neighborhood: data.neighborhood,
							number: data.number,
							complement: data.complement,
							userId,
							companyId: data.companyId,
							unitId: data.unitId,
						},
					}),
				);

				return reply.status(204).send();
			},
		);
}
