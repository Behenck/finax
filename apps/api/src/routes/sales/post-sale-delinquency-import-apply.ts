import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { SaleHistoryAction, SaleStatus } from "generated/prisma/enums";
import z from "zod";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	assertSaleDelinquencyImportRateLimit,
	saleDelinquencyImportRateLimit,
} from "./sale-delinquency-import-rate-limit";
import {
	PostSaleDelinquencyImportApplyBodySchema,
	PostSaleDelinquencyImportApplyResponseSchema,
} from "./sale-delinquency-import-schemas";
import {
	buildSaleDelinquencyImportPreview,
	isSaleDelinquencyImportPreviewRowReady,
} from "./sale-delinquency-import-service";
import { isSaleDelinquencyTemplateStoredName } from "./sale-delinquency-import-template-utils";
import { createSaleHistoryEvent } from "./sale-history";
import { parseSaleDateInput } from "./sale-schemas";

export async function postSaleDelinquencyImportApply(app: FastifyInstance) {
	app
		.withTypeProvider<ZodTypeProvider>()
		.register(auth)
		.post(
			"/organizations/:slug/sales/delinquency/imports/apply",
			{
				schema: {
					tags: ["sales"],
					summary: "Apply sale delinquency import",
					security: [{ bearerAuth: [] }],
					params: z.object({
						slug: z.string(),
					}),
					body: PostSaleDelinquencyImportApplyBodySchema,
					response: {
						200: PostSaleDelinquencyImportApplyResponseSchema,
					},
				},
			},
			async (request) => {
				const { slug } = request.params;
				const data = request.body;
				const actorId = await request.getCurrentUserId();
				const { organization } = await request.getUserMembership(slug);

				assertSaleDelinquencyImportRateLimit(
					`${organization.id}:${actorId}:sale-delinquency-imports:apply`,
					saleDelinquencyImportRateLimit.imports,
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

					if (!template || !isSaleDelinquencyTemplateStoredName(template.name)) {
						throw new BadRequestError(
							"Sale delinquency import template not found",
						);
					}
				}

				const importDate = parseSaleDateInput(data.importDate);
				const importMonth = data.importDate.slice(0, 7);
				const preview = await buildSaleDelinquencyImportPreview({
					prismaClient: prisma,
					organizationId: organization.id,
					importDate: data.importDate,
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
					saleId: string | null;
					delinquencyId: string | null;
				}[] = [];
				let applied = 0;

				await db(() =>
					prisma.$transaction(async (tx) => {
						const processedSaleMonthKeys = new Set<string>();

						for (const rowNumber of selectedRowNumbers) {
							const previewRow = previewByRowNumber.get(rowNumber);
							if (!previewRow) {
								results.push({
									rowNumber,
									result: "SKIPPED",
									reason: "Linha não encontrada na prévia.",
									saleId: null,
									delinquencyId: null,
								});
								continue;
							}

							if (
								!isSaleDelinquencyImportPreviewRowReady(previewRow) ||
								!previewRow.saleId
							) {
								results.push({
									rowNumber,
									result: "SKIPPED",
									reason: "Linha não está pronta para aplicação.",
									saleId: previewRow.saleId,
									delinquencyId: null,
								});
								continue;
							}

							const saleMonthKey = `${previewRow.saleId}:${importMonth}`;
							if (processedSaleMonthKeys.has(saleMonthKey)) {
								results.push({
									rowNumber,
									result: "SKIPPED",
									reason:
										"Linha duplicada no lote para a mesma venda e mês/ano de importação.",
									saleId: previewRow.saleId,
									delinquencyId: null,
								});
								continue;
							}

							const sale = await tx.sale.findFirst({
								where: {
									id: previewRow.saleId,
									organizationId: organization.id,
								},
								select: {
									id: true,
									status: true,
									saleDelinquencies: {
										where: {
											resolvedAt: null,
										},
										select: {
											dueDate: true,
										},
									},
								},
							});

							if (!sale) {
								results.push({
									rowNumber,
									result: "SKIPPED",
									reason: "Venda não encontrada durante aplicação.",
									saleId: previewRow.saleId,
									delinquencyId: null,
								});
								continue;
							}

							if (sale.status !== SaleStatus.COMPLETED) {
								results.push({
									rowNumber,
									result: "SKIPPED",
									reason:
										"Venda encontrada, mas não está com status COMPLETED.",
									saleId: sale.id,
									delinquencyId: null,
								});
								continue;
							}

							const hasOpenDelinquencyInImportMonth = sale.saleDelinquencies.some(
								(delinquency) =>
									delinquency.dueDate.toISOString().slice(0, 7) === importMonth,
							);
							if (hasOpenDelinquencyInImportMonth) {
								results.push({
									rowNumber,
									result: "SKIPPED",
									reason:
										"A venda já possui inadimplência aberta no mesmo mês/ano da importação.",
									saleId: sale.id,
									delinquencyId: null,
								});
								continue;
							}

							const createdDelinquency = await tx.saleDelinquency.create({
								data: {
									saleId: sale.id,
									organizationId: organization.id,
									dueDate: importDate,
									createdById: actorId,
								},
								select: {
									id: true,
								},
							});

							await createSaleHistoryEvent(tx, {
								saleId: sale.id,
								organizationId: organization.id,
								actorId,
								action: SaleHistoryAction.DELINQUENCY_CREATED,
								changes: [
									{
										path: "delinquency.dueDate",
										before: null,
										after: data.importDate,
									},
								],
							});

							processedSaleMonthKeys.add(saleMonthKey);
							applied += 1;
							results.push({
								rowNumber,
								result: "APPLIED",
								reason: "Inadimplência criada com sucesso.",
								saleId: sale.id,
								delinquencyId: createdDelinquency.id,
							});
						}
					}),
				);

				const requested = selectedRowNumbers.length;
				return {
					requested,
					applied,
					skipped: requested - applied,
					results,
				};
			},
		);
}
