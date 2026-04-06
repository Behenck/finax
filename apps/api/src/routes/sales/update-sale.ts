import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Prisma } from "generated/prisma/client";
import { CustomerStatus, SaleHistoryAction } from "generated/prisma/enums";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import { ForbiddenError } from "../_errors/forbidden-error";
import {
	recalculatePersistedSalePendingCommissionsAmounts,
	recalculatePersistedSaleCommissionsAmounts,
	replaceSaleCommissions,
	resolveSaleCommissionsData,
} from "./sale-commissions";
import {
	loadProductSaleFieldSchema,
	normalizeSaleDynamicFieldValues,
	parseSaleDynamicFieldSchemaJson,
	parseSaleDynamicFieldValuesJson,
} from "./sale-dynamic-fields";
import {
	buildSaleHistoryDiff,
	createSaleHistoryEvent,
	createSaleDiffHistoryEvent,
	loadSaleHistorySnapshot,
	type SaleHistoryChange,
} from "./sale-history";
import { resolveSaleResponsibleData } from "./sale-responsible";
import { parseSaleDateInput, UpdateSaleBodySchema } from "./sale-schemas";
import { syncPendingSaleTransactionFromSale } from "./sale-transactions";

const INSTALLMENT_HISTORY_PATH_REGEX =
	/^commissions\[\d+\]\.installments\[\d+\]\./;

function compactChangesForPendingInstallmentsUpdate(params: {
	changes: SaleHistoryChange[];
	updatedPendingInstallmentsCount: number;
}) {
	const compactedChanges = params.changes.filter(
		(change) => !INSTALLMENT_HISTORY_PATH_REGEX.test(change.path),
	);

	if (params.updatedPendingInstallmentsCount <= 0) {
		return compactedChanges;
	}

	return [
		...compactedChanges,
		{
			path: "sale.pendingCommissionInstallmentsUpdatedCount",
			before: null,
			after: params.updatedPendingInstallmentsCount,
		},
	];
}

export async function updateSale(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.put(
			"/organizations/:slug/sales/:saleId",
			{
				schema: {
					tags: ["sales"],
					summary: "Update sale",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
						saleId: z.uuid(),
					}),
					body: UpdateSaleBodySchema,
					response: {
						204: z.null(),
					},
				},
			},
			async (request, reply) => {
				const { slug, saleId } = request.params;
				const data = request.body;
				const actorId = await request.getCurrentUserId();

				const organization = await prisma.organization.findUnique({
					where: {
						slug,
					},
					select: {
						id: true,
						enableSalesTransactionsSync: true,
					},
				});

				if (!organization) {
					throw new BadRequestError("Organization not found");
				}

				const sale = await prisma.sale.findFirst({
					where: {
						id: saleId,
						organizationId: organization.id,
					},
					select: {
						id: true,
						status: true,
						totalAmount: true,
						productId: true,
						dynamicFieldSchema: true,
						dynamicFieldValues: true,
						commissions: {
							select: {
								id: true,
							},
							take: 1,
						},
					},
				});

				if (!sale) {
					throw new BadRequestError("Sale not found");
				}

				const [
					canUpdateSale,
					canCreateSale,
					canCreateCommissions,
					canUpdateCommissions,
				] = await Promise.all([
					request.hasPermission(slug, "sales.update"),
					request.hasPermission(slug, "sales.create"),
					request.hasPermission(slug, "sales.commissions.create"),
					request.hasPermission(slug, "sales.commissions.update"),
				]);
				const canEditPendingSaleByCreatePermission =
					canCreateSale && sale.status === "PENDING";
				if (!canUpdateSale && !canEditPendingSaleByCreatePermission) {
					throw new ForbiddenError(
						`You don't have permission to access "sales.update".`,
					);
				}
				const canManageCommissionsOnUpdate =
					canCreateCommissions && canUpdateCommissions;

				if (data.commissions !== undefined && !canManageCommissionsOnUpdate) {
					if (!canCreateCommissions) {
						await request.requirePermission(slug, "sales.commissions.create");
					}

					if (!canUpdateCommissions) {
						await request.requirePermission(slug, "sales.commissions.update");
					}
				}

				const beforeSnapshot = await loadSaleHistorySnapshot(
					prisma,
					saleId,
					organization.id,
				);

				if (!beforeSnapshot) {
					throw new BadRequestError("Sale not found");
				}

				if (sale.status !== "PENDING" && data.commissions !== undefined) {
					throw new BadRequestError(
						"Cannot update commissions when sale status is not PENDING",
					);
				}

				const hasPersistedCommissions = sale.commissions.length > 0;
				const isChangingTotalAmount = data.totalAmount !== sale.totalAmount;
				if (
					!canManageCommissionsOnUpdate &&
					data.commissions === undefined &&
					hasPersistedCommissions &&
					isChangingTotalAmount &&
					sale.status !== "PENDING"
				) {
					throw new ForbiddenError(
						`You don't have permission to access "sales.commissions.update".`,
					);
				}
				const isCompletedSaleWithPersistedCommissionsAmountChange =
					data.commissions === undefined &&
					hasPersistedCommissions &&
					isChangingTotalAmount &&
					sale.status === "COMPLETED";
				if (
					isCompletedSaleWithPersistedCommissionsAmountChange &&
					data.applyValueChangeToCommissions === undefined
				) {
					throw new BadRequestError(
						"applyValueChangeToCommissions is required when changing totalAmount on a COMPLETED sale with commissions",
					);
				}
				const shouldApplyAmountChangeToPendingCommissions =
					isCompletedSaleWithPersistedCommissionsAmountChange &&
					data.applyValueChangeToCommissions === true;
				const shouldSkipPersistedCommissionsRecalculation =
					isCompletedSaleWithPersistedCommissionsAmountChange &&
					data.applyValueChangeToCommissions === false;

				const customer = await prisma.customer.findFirst({
					where: {
						id: data.customerId,
						organizationId: organization.id,
						status: CustomerStatus.ACTIVE,
					},
					select: {
						id: true,
					},
				});

				if (!customer) {
					throw new BadRequestError("Customer not found or inactive");
				}

				const product = await prisma.product.findFirst({
					where: {
						id: data.productId,
						organizationId: organization.id,
						isActive: true,
					},
					select: {
						id: true,
					},
				});

				if (!product) {
					throw new BadRequestError("Product not found or inactive");
				}

				const isProductChanged = sale.productId !== data.productId;
				const saleDynamicFieldSchema = parseSaleDynamicFieldSchemaJson(
					sale.dynamicFieldSchema,
				);
				const saleDynamicFieldValues = parseSaleDynamicFieldValuesJson(
					sale.dynamicFieldValues,
				);

				const dynamicFieldSchema = isProductChanged
					? await loadProductSaleFieldSchema(prisma, data.productId)
					: saleDynamicFieldSchema;

				if (isProductChanged && data.dynamicFields === undefined) {
					throw new BadRequestError(
						"Dynamic fields are required when changing product",
					);
				}

				const dynamicFieldValues =
					data.dynamicFields === undefined
						? saleDynamicFieldValues
						: normalizeSaleDynamicFieldValues({
								schema: dynamicFieldSchema,
								input: data.dynamicFields,
							});

				const company = await prisma.company.findFirst({
					where: {
						id: data.companyId,
						organizationId: organization.id,
					},
					select: {
						id: true,
					},
				});

				if (!company) {
					throw new BadRequestError("Company not found");
				}

				if (data.unitId) {
					const unit = await prisma.unit.findFirst({
						where: {
							id: data.unitId,
							companyId: data.companyId,
						},
						select: {
							id: true,
						},
					});

					if (!unit) {
						throw new BadRequestError("Unit not found for company");
					}
				}

				const responsibleData = await resolveSaleResponsibleData(
					organization.id,
					data.responsible,
				);
				const resolvedCommissions =
					data.commissions === undefined
						? undefined
						: await resolveSaleCommissionsData(
								organization.id,
								data.commissions,
								data.totalAmount,
							);

				await db(() =>
					prisma.$transaction(async (tx) => {
						let updatedPendingInstallmentsCount = 0;

						await tx.sale.update({
							where: {
								id: saleId,
							},
							data: {
								companyId: data.companyId,
								unitId: data.unitId,
								customerId: data.customerId,
								productId: data.productId,
								saleDate: parseSaleDateInput(data.saleDate),
								totalAmount: data.totalAmount,
								notes: data.notes ?? null,
								dynamicFieldSchema:
									dynamicFieldSchema as unknown as Prisma.InputJsonValue,
								dynamicFieldValues:
									dynamicFieldValues as unknown as Prisma.InputJsonValue,
								...responsibleData,
							},
						});

						if (resolvedCommissions !== undefined) {
							await replaceSaleCommissions(tx, saleId, resolvedCommissions);
						} else if (shouldApplyAmountChangeToPendingCommissions) {
							updatedPendingInstallmentsCount =
								await recalculatePersistedSalePendingCommissionsAmounts(
									tx,
									saleId,
									data.totalAmount,
								);
						} else if (!shouldSkipPersistedCommissionsRecalculation) {
							await recalculatePersistedSaleCommissionsAmounts(
								tx,
								saleId,
								data.totalAmount,
							);
						}

						if (organization.enableSalesTransactionsSync) {
							await syncPendingSaleTransactionFromSale(tx, {
								saleId,
								organizationId: organization.id,
							});
						}

						const afterSnapshot = await loadSaleHistorySnapshot(
							tx,
							saleId,
							organization.id,
						);

						if (!afterSnapshot) {
							throw new BadRequestError("Sale not found");
						}

						if (shouldApplyAmountChangeToPendingCommissions) {
							const changes = compactChangesForPendingInstallmentsUpdate({
								changes: buildSaleHistoryDiff(beforeSnapshot, afterSnapshot),
								updatedPendingInstallmentsCount,
							});

							await createSaleHistoryEvent(tx, {
								saleId,
								organizationId: organization.id,
								actorId,
								action: SaleHistoryAction.UPDATED,
								changes,
							});
						} else {
							await createSaleDiffHistoryEvent(tx, {
								saleId,
								organizationId: organization.id,
								actorId,
								action: SaleHistoryAction.UPDATED,
								beforeSnapshot,
								afterSnapshot,
							});
						}
					}),
				);

				return reply.status(204).send();
			},
		);
}
