import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	TransactionNature,
	TransactionStatus,
	TransactionType,
} from "generated/prisma/enums";

const ChildCategorySchema = z.object({
	id: z.uuid(),
	name: z.string(),
	icon: z.string(),
	color: z.string(),
});

const CategorySchema = z.object({
	id: z.uuid(),
	name: z.string(),
	icon: z.string(),
	color: z.string(),
	children: ChildCategorySchema.nullable(),
});

const TransactionItemSchema = z.object({
	id: z.uuid(),
	description: z.string(),
	amount: z.number(),
	categoryId: z.uuid(),
});

const TransactionSchema = z.object({
	id: z.uuid(),
	saleId: z.uuid().nullable(),
	code: z.string(),
	description: z.string(),
	totalAmount: z.number(),
	type: z.enum(TransactionType),
	status: z.enum(TransactionStatus),
	nature: z.enum(TransactionNature),
	dueDate: z.date(),
	expectedPaymentDate: z.date(),
	paymentDate: z.date().nullable(),
	notes: z.string().nullable(),
	costCenterId: z.uuid(),
	companyId: z.uuid(),
	unitId: z.uuid().nullable(),
	createdById: z.uuid(),
	refundedByEmployeeId: z.uuid().nullable(),
	categoryId: z.uuid(),
	transactionItens: z.array(TransactionItemSchema),
});

/**
 * ============================
 * Route
 * ============================
 */

export async function getTransaction(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/transactions/:transactionId",
			{
				schema: {
					tags: ["transactions"],
					summary: "Get transaction",
					security: [{ bearerAuth: [] }],

					params: z.object({
						slug: z.string(),
						transactionId: z.uuid(),
					}),

					response: {
						200: z.object({
							transaction: TransactionSchema,
						}),
					},
				},
			},
			async (request) => {
				const { slug, transactionId } = request.params;

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

				const transaction = await prisma.transaction.findUnique({
					where: {
						organizationId: organization.id,
						id: transactionId,
					},
					select: {
						id: true,
						saleId: true,
						code: true,
						description: true,
						totalAmount: true,
						type: true,
						status: true,
						nature: true,
						dueDate: true,
						expectedPaymentDate: true,
						paymentDate: true,
						notes: true,
						costCenterId: true,
						companyId: true,
						unitId: true,
						createdById: true,
						refundedByEmployeeId: true,
						categoryId: true,
						transactionItens: {
							select: {
								id: true,
								description: true,
								amount: true,
								categoryId: true,
							},
						},
					},
				});

				if (!transaction) {
					throw new BadRequestError("Transaction not found");
				}

				return {
					transaction,
				};
			},
		);
}
