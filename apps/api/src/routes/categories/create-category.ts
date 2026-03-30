import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { TransactionType } from "generated/prisma/enums";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";

export async function createCategory(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/categories",
			{
				schema: {
					tags: ["categories"],
					summary: "Create a new category",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: z.object({
						name: z.string().trim().min(1),
						code: z.string().optional(),
						type: z.enum(TransactionType),
						icon: z.string(),
						parentId: z.string().optional(),
						color: z.string(),
					}),
					response: {
						201: z.object({
							categoryId: z.uuid(),
						}),
					},
				},
			},
			async (request, reply) => {
				const { slug } = request.params;

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

				if (data.parentId) {
					const parent = await prisma.category.findFirst({
						where: {
							id: data.parentId,
							organizationId: organization.id,
						},
						select: { id: true },
					});

					if (!parent) {
						throw new BadRequestError("Parent category not found");
					}
				}

				const category = await db(() =>
					prisma.category.create({
						data: {
							name: data.name,
							code: data.code,
							type: data.type,
							organizationId: organization.id,
							color: data.color,
							icon: data.icon,
							parentId: data.parentId,
						},
					}),
				);

				return reply.status(201).send({
					categoryId: category.id,
				});
			},
		);
}
