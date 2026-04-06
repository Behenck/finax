import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { handlePrismaError } from "../_errors/prisma-error";
import {
	fromScaledReversalPercentage,
	GetProductCommissionReversalRulesResponseSchema,
} from "./commission-reversal-rules-schema";

type ProductReversalMode = "INSTALLMENT_BY_NUMBER" | "TOTAL_PAID_PERCENTAGE";

type ProductLocalReversalConfig = {
	mode: ProductReversalMode | null;
	totalPaidPercentage: number | null;
	rules: Array<{
		installmentNumber: number;
		percentage: number;
	}>;
};

const paramsSchema = z.object({
	slug: z.string(),
	id: z.uuid(),
});

const querystringSchema = z.object({
	includeInherited: z.coerce.boolean().optional().default(false),
});

function inferProductReversalMode(params: {
	storedMode: ProductReversalMode | null;
	totalPaidPercentage: number | null;
	rulesCount: number;
}) {
	if (params.storedMode) {
		return params.storedMode;
	}

	if (params.totalPaidPercentage !== null) {
		return "TOTAL_PAID_PERCENTAGE" as const;
	}

	if (params.rulesCount > 0) {
		return "INSTALLMENT_BY_NUMBER" as const;
	}

	return null;
}

function resolveLocalConfig(candidate: {
	commissionReversalMode: ProductReversalMode | null;
	commissionReversalTotalPercentage: number | null;
	rules: Array<{
		installmentNumber: number;
		percentage: number;
	}>;
}): ProductLocalReversalConfig {
	const mode = inferProductReversalMode({
		storedMode: candidate.commissionReversalMode,
		totalPaidPercentage: candidate.commissionReversalTotalPercentage,
		rulesCount: candidate.rules.length,
	});

	if (!mode) {
		return {
			mode: null,
			totalPaidPercentage: null,
			rules: [],
		};
	}

	if (mode === "TOTAL_PAID_PERCENTAGE") {
		if (candidate.commissionReversalTotalPercentage === null) {
			return {
				mode: null,
				totalPaidPercentage: null,
				rules: [],
			};
		}

		return {
			mode,
			totalPaidPercentage: fromScaledReversalPercentage(
				candidate.commissionReversalTotalPercentage,
			),
			rules: [],
		};
	}

	if (candidate.rules.length === 0) {
		return {
			mode: null,
			totalPaidPercentage: null,
			rules: [],
		};
	}

	return {
		mode,
		totalPaidPercentage: null,
		rules: candidate.rules.map((rule) => ({
			installmentNumber: rule.installmentNumber,
			percentage: fromScaledReversalPercentage(rule.percentage),
		})),
	};
}

function hasValidLocalConfig(config: ProductLocalReversalConfig) {
	if (config.mode === "INSTALLMENT_BY_NUMBER") {
		return config.rules.length > 0;
	}

	if (config.mode === "TOTAL_PAID_PERCENTAGE") {
		return config.totalPaidPercentage !== null;
	}

	return false;
}

async function loadProductLocalReversalConfig(params: {
	organizationId: string;
	productId: string;
	prismaClient: Pick<Prisma.TransactionClient, "product">;
}) {
	const product = await params.prismaClient.product.findFirst({
		where: {
			id: params.productId,
			organizationId: params.organizationId,
		},
		select: {
			id: true,
			parentId: true,
			commissionReversalMode: true,
			commissionReversalTotalPercentage: true,
			commissionReversalRules: {
				orderBy: {
					installmentNumber: "asc",
				},
				select: {
					installmentNumber: true,
					percentage: true,
				},
			},
		},
	});

	if (!product) {
		return null;
	}

	return {
		productId: product.id,
		parentId: product.parentId,
		config: resolveLocalConfig({
			commissionReversalMode: product.commissionReversalMode,
			commissionReversalTotalPercentage:
				product.commissionReversalTotalPercentage,
			rules: product.commissionReversalRules,
		}),
	};
}

export async function getProductCommissionReversalRules(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.get(
			"/organizations/:slug/products/:id/commission-reversal-rules",
			{
				schema: {
					tags: ["products"],
					summary: "Get product commission reversal rules",
					security: [{ bearerAuth: [] }],
					params: paramsSchema,
					querystring: querystringSchema,
					response: {
						200: GetProductCommissionReversalRulesResponseSchema,
					},
				},
			},
			async (request) => {
				try {
					const { slug, id } = request.params;
					const { includeInherited } = request.query;

					const organization = await prisma.organization.findUnique({
						where: { slug },
						select: { id: true },
					});

					if (!organization) {
						throw new BadRequestError("Organization not found");
					}

					const currentProduct = await prisma.product.findFirst({
						where: {
							id,
							organizationId: organization.id,
						},
						select: {
							id: true,
						},
					});

					if (!currentProduct) {
						throw new BadRequestError("Product not found");
					}

					const localConfigEntry = await loadProductLocalReversalConfig({
						organizationId: organization.id,
						productId: id,
						prismaClient: prisma,
					});

					if (!localConfigEntry) {
						throw new BadRequestError("Product not found");
					}

					if (!includeInherited) {
						return localConfigEntry.config;
					}

					if (hasValidLocalConfig(localConfigEntry.config)) {
						return localConfigEntry.config;
					}

					const visitedProductIds = new Set<string>([localConfigEntry.productId]);
					let currentParentId = localConfigEntry.parentId;

					while (currentParentId) {
						if (visitedProductIds.has(currentParentId)) {
							break;
						}

						visitedProductIds.add(currentParentId);
						const parentConfigEntry = await loadProductLocalReversalConfig({
							organizationId: organization.id,
							productId: currentParentId,
							prismaClient: prisma,
						});

						if (!parentConfigEntry) {
							break;
						}

						if (hasValidLocalConfig(parentConfigEntry.config)) {
							return parentConfigEntry.config;
						}

						currentParentId = parentConfigEntry.parentId;
					}

					return {
						mode: null,
						totalPaidPercentage: null,
						rules: [],
					};
				} catch (error) {
					handlePrismaError(error);
				}
			},
		);
}
