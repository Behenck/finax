import type { Prisma } from "generated/prisma/client";
import {
	TransactionNature,
	TransactionStatus,
	TransactionType,
} from "generated/prisma/enums";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { normalizeCategory } from "./utils/normalize-category";

const saleDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const transactionSortByValues = [
	"dueDate",
	"expectedPaymentDate",
	"description",
	"totalAmount",
	"status",
	"createdAt",
] as const;

const transactionSortDirectionValues = ["asc", "desc"] as const;

type RawCategory = {
	id: string;
	name: string;
	icon: string;
	color: string;
	parent?: {
		id: string;
		name: string;
		icon: string;
		color: string;
	} | null;
};

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
	category: CategorySchema,
});

const TransactionSchema = z.object({
	id: z.uuid(),
	code: z.string(),
	description: z.string(),
	totalAmount: z.number(),
	type: z.enum(TransactionType),
	status: z.enum(TransactionStatus),
	nature: z.enum(TransactionNature),
	dueDate: z.date(),
	expectedPaymentDate: z.date(),
	paymentDate: z.date().nullable(),
	createdBy: z.object({
		id: z.uuid(),
		name: z.string().nullable(),
		avatarUrl: z.url().nullable(),
	}),
	refundedByEmployee: z
		.object({
			id: z.uuid(),
			name: z.string().nullable(),
		})
		.nullable(),
	costCenter: z.object({
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
	category: CategorySchema,
	transactionItens: z.array(TransactionItemSchema),
});

const GetTransactionsQuerySchema = z
	.object({
		q: z.string().trim().default(""),
		status: z.enum(TransactionStatus).optional(),
		type: z.enum(TransactionType).optional(),
		companyId: z.uuid().optional(),
		unitId: z.uuid().optional(),
		dueFrom: z
			.string()
			.regex(saleDateRegex)
			.optional(),
		dueTo: z
			.string()
			.regex(saleDateRegex)
			.optional(),
		page: z.coerce.number().int().min(1).default(1),
		pageSize: z.coerce.number().int().min(1).max(100).default(20),
		sortBy: z.enum(transactionSortByValues).default("dueDate"),
		sortDir: z.enum(transactionSortDirectionValues).default("desc"),
	})
	.strict();

function parseDateInput(value: string, endOfDay: boolean) {
	const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
	return new Date(`${value}${suffix}`);
}

function toTransactionOrderBy(
	sortBy: z.infer<typeof GetTransactionsQuerySchema>["sortBy"],
	sortDir: z.infer<typeof GetTransactionsQuerySchema>["sortDir"],
): Prisma.TransactionOrderByWithRelationInput {
	if (sortBy === "dueDate") {
		return {
			dueDate: sortDir,
		};
	}

	if (sortBy === "expectedPaymentDate") {
		return {
			expectedPaymentDate: sortDir,
		};
	}

	if (sortBy === "description") {
		return {
			description: sortDir,
		};
	}

	if (sortBy === "totalAmount") {
		return {
			totalAmount: sortDir,
		};
	}

	if (sortBy === "status") {
		return {
			status: sortDir,
		};
	}

	return {
		createdAt: sortDir,
	};
}

export async function getTransactions(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/transactions",
			{
				schema: {
					tags: ["transactions"],
					summary: "Get transactions",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					querystring: GetTransactionsQuerySchema,
					response: {
						200: z.object({
							transactions: z.array(TransactionSchema),
							pagination: z.object({
								page: z.number().int().min(1),
								pageSize: z.number().int().min(1).max(100),
								total: z.number().int().nonnegative(),
								totalPages: z.number().int().min(1),
							}),
						}),
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const {
					q,
					status,
					type,
					companyId,
					unitId,
					dueFrom,
					dueTo,
					page,
					pageSize,
					sortBy,
					sortDir,
				} = request.query;

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

				const where: Prisma.TransactionWhereInput = {
					organizationId: organization.id,
				};

				if (q) {
					where.OR = [
						{
							description: {
								contains: q,
								mode: "insensitive",
							},
						},
						{
							code: {
								contains: q,
								mode: "insensitive",
							},
						},
					];
				}

				if (status) {
					where.status = status;
				}

				if (type) {
					where.type = type;
				}

				if (companyId) {
					where.companyId = companyId;
				}

				if (unitId) {
					where.unitId = unitId;
				}

				if (dueFrom || dueTo) {
					where.dueDate = {
						gte: dueFrom ? parseDateInput(dueFrom, false) : undefined,
						lte: dueTo ? parseDateInput(dueTo, true) : undefined,
					};
				}

				const [transactions, total] = await Promise.all([
					prisma.transaction.findMany({
						where,
						orderBy: [
							toTransactionOrderBy(sortBy, sortDir),
							{
								createdAt: "desc",
							},
						],
						skip: (page - 1) * pageSize,
						take: pageSize,
						select: {
							id: true,
							code: true,
							description: true,
							totalAmount: true,
							type: true,
							status: true,
							nature: true,
							dueDate: true,
							expectedPaymentDate: true,
							paymentDate: true,
							costCenter: {
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
							createdBy: {
								select: {
									id: true,
									name: true,
									avatarUrl: true,
								},
							},
							refundedByEmployee: {
								select: {
									id: true,
									name: true,
								},
							},
							category: {
								select: {
									id: true,
									name: true,
									icon: true,
									color: true,
									parent: {
										select: {
											id: true,
											name: true,
											icon: true,
											color: true,
										},
									},
								},
							},
							transactionItens: {
								select: {
									id: true,
									description: true,
									amount: true,
									category: {
										select: {
											id: true,
											name: true,
											icon: true,
											color: true,
											parent: {
												select: {
													id: true,
													name: true,
													icon: true,
													color: true,
												},
											},
										},
									},
								},
							},
						},
					}),
					prisma.transaction.count({ where }),
				]);

				const normalizedTransactions = transactions.map((transaction) => ({
					...transaction,
					category: normalizeCategory(transaction.category as RawCategory),
					transactionItens: transaction.transactionItens.map((item) => ({
						...item,
						category: normalizeCategory(item.category as RawCategory),
					})),
				}));

				return {
					transactions: normalizedTransactions,
					pagination: {
						page,
						pageSize,
						total,
						totalPages: Math.max(1, Math.ceil(total / pageSize)),
					},
				};
			},
		);
}
