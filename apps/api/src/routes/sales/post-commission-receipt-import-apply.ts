import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	SaleCommissionInstallmentStatus,
	SaleCommissionDirection,
	SaleHistoryAction,
	SaleStatus,
} from "generated/prisma/enums";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	assertCommissionReceiptImportRateLimit,
	commissionReceiptImportRateLimit,
} from "./commission-receipt-import-rate-limit";
import {
	PostCommissionReceiptImportApplyBodySchema,
	PostCommissionReceiptImportApplyResponseSchema,
} from "./commission-receipt-import-schemas";
import { buildCommissionReceiptImportPreview } from "./commission-receipt-import-service";
import { isCommissionReceiptTemplateStoredName } from "./commission-receipt-import-template-utils";
import {
	createSaleDiffHistoryEvent,
	loadSaleHistorySnapshot,
} from "./sale-history";
import { parseSaleDateInput } from "./sale-schemas";

export async function postCommissionReceiptImportApply(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/commissions/receipts/imports/apply",
			{
				schema: {
					tags: ["sales"],
					summary: "Apply commission receipt import",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: PostCommissionReceiptImportApplyBodySchema,
					response: {
						200: PostCommissionReceiptImportApplyResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const data = request.body;
				const actorId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				assertCommissionReceiptImportRateLimit(
					`${organization.id}:${actorId}:commission-receipt-imports:apply`,
					commissionReceiptImportRateLimit.imports,
				);

				if (data.templateId) {
					const template = await prisma.saleImportTemplate.findFirst({
						where: {
							id: data.templateId,
							organizationId: organization.id,
						},
						select: {
							id: true,
							name: true,
						},
					});

					if (
						!template ||
						!isCommissionReceiptTemplateStoredName(template.name)
					) {
						throw new BadRequestError(
							"Commission receipt import template not found",
						);
					}
				}

				const importDate = parseSaleDateInput(data.importDate);
				const preview = await buildCommissionReceiptImportPreview({
					prismaClient: prisma,
					organizationId: organization.id,
					rows: data.rows,
					mapping: data.mapping,
				});

				const previewByRowNumber = new Map(
					preview.rows.map((row) => [row.rowNumber, row]),
				);
				const selectedRowNumbers = Array.from(new Set(data.selectedRowNumbers));
				const results: {
					rowNumber: number;
					result: "APPLIED" | "SKIPPED";
					reason: string;
					installmentId: string | null;
					saleId: string | null;
				}[] = [];

				let applied = 0;

				await db(() =>
					prisma.$transaction(async (tx) => {
						for (const rowNumber of selectedRowNumbers) {
							const previewRow = previewByRowNumber.get(rowNumber);

							if (!previewRow) {
								results.push({
									rowNumber,
									result: "SKIPPED",
									reason: "Linha não encontrada na prévia.",
									installmentId: null,
									saleId: null,
								});
								continue;
							}

							if (
								previewRow.status !== "READY" ||
								(previewRow.action !== "MARK_AS_PAID" &&
									previewRow.action !== "UPDATE_AMOUNT_AND_MARK_AS_PAID" &&
									previewRow.action !== "REVERSE_INSTALLMENT") ||
								!previewRow.installmentId ||
								!previewRow.saleId ||
								!previewRow.saleDate
							) {
								results.push({
									rowNumber,
									result: "SKIPPED",
									reason: "Linha não está pronta para aplicação.",
									installmentId: previewRow.installmentId,
									saleId: previewRow.saleId,
								});
								continue;
							}

							const isUpdateAndMarkAsPaid =
								previewRow.action === "UPDATE_AMOUNT_AND_MARK_AS_PAID";
							const isReverseInstallment =
								previewRow.action === "REVERSE_INSTALLMENT";
							const shouldUpdateAmount = isUpdateAndMarkAsPaid;
							const amountToApply = shouldUpdateAmount
								? previewRow.receivedAmount
								: null;
							const reversalAmountToApply = isReverseInstallment
								? previewRow.receivedAmount
								: null;

							if (isUpdateAndMarkAsPaid && amountToApply === null) {
								results.push({
									rowNumber,
									result: "SKIPPED",
									reason:
										"Linha não está pronta para atualização de valor na aplicação.",
									installmentId: previewRow.installmentId,
									saleId: previewRow.saleId,
								});
								continue;
							}

							if (
								isUpdateAndMarkAsPaid &&
								amountToApply !== null &&
								amountToApply <= 0
							) {
								results.push({
									rowNumber,
									result: "SKIPPED",
									reason:
										"Linha não está pronta para atualização de valor positivo.",
									installmentId: previewRow.installmentId,
									saleId: previewRow.saleId,
								});
								continue;
							}

							if (
								isReverseInstallment &&
								(reversalAmountToApply === null || reversalAmountToApply >= 0)
							) {
								results.push({
									rowNumber,
									result: "SKIPPED",
									reason:
										"Linha não está pronta para aplicar estorno com valor negativo.",
									installmentId: previewRow.installmentId,
									saleId: previewRow.saleId,
								});
								continue;
							}

							const previewSaleDate = parseSaleDateInput(previewRow.saleDate);
							const installmentStatusFilter = isReverseInstallment
								? {
										in: [
											SaleCommissionInstallmentStatus.PENDING,
											SaleCommissionInstallmentStatus.PAID,
										],
									}
								: SaleCommissionInstallmentStatus.PENDING;

							const installment = await tx.saleCommissionInstallment.findFirst({
								where: {
									id: previewRow.installmentId,
									status: installmentStatusFilter,
									...(isReverseInstallment
										? {
												originInstallmentId: null,
											}
										: {}),
									saleCommission: {
										saleId: previewRow.saleId,
										direction: SaleCommissionDirection.INCOME,
										sale: {
											organizationId: organization.id,
											saleDate: previewSaleDate,
											status: {
												notIn: [SaleStatus.PENDING, SaleStatus.CANCELED],
											},
										},
									},
								},
								select: {
									id: true,
									originInstallmentId: true,
									installmentNumber: true,
									percentage: true,
									status: true,
									amount: true,
									expectedPaymentDate: true,
									paymentDate: true,
									saleCommissionId: true,
									saleCommission: {
										select: {
											saleId: true,
										},
									},
								},
							});

							if (!installment) {
								results.push({
									rowNumber,
									result: "SKIPPED",
									reason:
										"Linha mudou entre prévia e confirmação. Atualize a prévia.",
									installmentId: previewRow.installmentId,
									saleId: previewRow.saleId,
								});
								continue;
							}

							const beforeSnapshot = await loadSaleHistorySnapshot(
								tx,
								installment.saleCommission.saleId,
								organization.id,
							);

							if (!beforeSnapshot) {
								results.push({
									rowNumber,
									result: "SKIPPED",
									reason: "Venda não encontrada durante aplicação.",
									installmentId: previewRow.installmentId,
									saleId: previewRow.saleId,
								});
								continue;
							}

							let appliedInstallmentId = installment.id;
							let isDirectBaseReversalApplied = false;

							if (isReverseInstallment) {
								if (installment.originInstallmentId) {
									results.push({
										rowNumber,
										result: "SKIPPED",
										reason:
											"Linha mudou entre prévia e confirmação. Atualize a prévia.",
										installmentId: previewRow.installmentId,
										saleId: previewRow.saleId,
									});
									continue;
								}

								const hasLaterPaidInstallment =
									(await tx.saleCommissionInstallment.count({
										where: {
											saleCommissionId: installment.saleCommissionId,
											originInstallmentId: null,
											installmentNumber: {
												gt: installment.installmentNumber,
											},
											status: SaleCommissionInstallmentStatus.PAID,
										},
									})) > 0;

								if (hasLaterPaidInstallment) {
									results.push({
										rowNumber,
										result: "SKIPPED",
										reason:
											"Não é possível estornar esta parcela porque existe parcela posterior já paga.",
										installmentId: installment.id,
										saleId: installment.saleCommission.saleId,
									});
									continue;
								}

								const existingReversedAggregate =
									await tx.saleCommissionInstallment.aggregate({
										where: {
											originInstallmentId: installment.id,
											status: SaleCommissionInstallmentStatus.REVERSED,
										},
										_sum: {
											amount: true,
										},
									});
								const existingReversedAmountAbsolute = Math.abs(
									existingReversedAggregate._sum.amount ?? 0,
								);
								const nextReversalAmountAbsolute = Math.abs(
									reversalAmountToApply ?? 0,
								);
								if (
									existingReversedAmountAbsolute + nextReversalAmountAbsolute >
									installment.amount
								) {
									results.push({
										rowNumber,
										result: "SKIPPED",
										reason:
											"Valor de estorno excede o valor disponível da parcela base.",
										installmentId: installment.id,
										saleId: installment.saleCommission.saleId,
									});
									continue;
								}

								const isFullDirectReversal =
									existingReversedAmountAbsolute === 0 &&
									nextReversalAmountAbsolute === installment.amount;

								if (isFullDirectReversal) {
									await tx.saleCommissionInstallment.update({
										where: {
											id: installment.id,
										},
										data: {
											status: SaleCommissionInstallmentStatus.REVERSED,
											amount: reversalAmountToApply ?? 0,
											paymentDate: importDate,
											reversedFromStatus: installment.status,
											reversedFromAmount: installment.amount,
											reversedFromPaymentDate: installment.paymentDate,
										},
									});
									isDirectBaseReversalApplied = true;
								} else {
									const createdReversalInstallment =
										await tx.saleCommissionInstallment.create({
											data: {
												saleCommissionId: installment.saleCommissionId,
												originInstallmentId: installment.id,
												installmentNumber: installment.installmentNumber,
												percentage: installment.percentage,
												amount: reversalAmountToApply ?? 0,
												status: SaleCommissionInstallmentStatus.REVERSED,
												expectedPaymentDate: installment.expectedPaymentDate,
												paymentDate: importDate,
											},
											select: {
												id: true,
											},
										});
									appliedInstallmentId = createdReversalInstallment.id;
								}
							} else {
								await tx.saleCommissionInstallment.update({
									where: {
										id: installment.id,
									},
									data: {
										...(amountToApply === null
											? {}
											: { amount: amountToApply }),
										status: "PAID",
										paymentDate: importDate,
										reversedFromStatus: null,
										reversedFromAmount: null,
										reversedFromPaymentDate: null,
									},
								});
							}

							const afterSnapshot = await loadSaleHistorySnapshot(
								tx,
								installment.saleCommission.saleId,
								organization.id,
							);

							if (afterSnapshot) {
								await createSaleDiffHistoryEvent(tx, {
									saleId: installment.saleCommission.saleId,
									organizationId: organization.id,
									actorId,
									action:
										shouldUpdateAmount || isReverseInstallment
											? SaleHistoryAction.COMMISSION_INSTALLMENT_UPDATED
											: SaleHistoryAction.COMMISSION_INSTALLMENT_STATUS_UPDATED,
									beforeSnapshot,
									afterSnapshot,
								});
							}

							applied += 1;
							results.push({
								rowNumber,
								result: "APPLIED",
								reason: isReverseInstallment
									? isDirectBaseReversalApplied
										? "Parcela estornada diretamente com sucesso."
										: "Movimento de estorno criado com sucesso."
									: shouldUpdateAmount
										? "Parcela atualizada e marcada como paga com sucesso."
										: "Parcela marcada como paga com sucesso.",
								installmentId: appliedInstallmentId,
								saleId: installment.saleCommission.saleId,
							});
						}
					}),
				);

				return {
					requested: selectedRowNumbers.length,
					applied,
					skipped: selectedRowNumbers.length - applied,
					results,
				};
			},
		);
}
