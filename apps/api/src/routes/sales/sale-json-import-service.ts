import { addMonths } from "date-fns";
import type { Prisma } from "generated/prisma/client";
import {
	CustomerDocumentType,
	CustomerPersonType,
	CustomerStatus,
	PartnerStatus,
	Role,
	SaleCommissionInstallmentStatus,
	SaleResponsibleType,
	SaleStatus,
	SellerStatus,
} from "generated/prisma/enums";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { getPartnerDisplayName } from "@/utils/partner-display";
import { BadRequestError } from "../_errors/bad-request-error";
import {
	loadProductSaleFieldSchema,
	normalizeSaleDynamicFieldValues,
} from "./sale-dynamic-fields";
import {
	createSaleCreatedHistoryEvent,
	loadSaleHistorySnapshot,
} from "./sale-history";
import {
	buildProductResolver,
	isValidCnpj,
	isValidCpf,
	mapDynamicImportRawValue,
	normalizeDocumentDigits,
	normalizeEmail,
	normalizePhoneDigits,
	parseImportAmountToCents,
	parseImportSaleDate,
	sanitizeTextValue,
} from "./sale-import-utils";
import {
	type SaleJsonImportApplyBody,
	type SaleJsonImportCota,
	type SaleJsonImportPreviewBody,
} from "./sale-json-import-schemas";
import { deriveSaleCommissionDirectionFromRecipientType } from "./sale-commissions";
import { parseSaleDateInput, toScaledPercentage } from "./sale-schemas";

type PreviewContext = Awaited<ReturnType<typeof buildPreviewContext>>;

type ParsedCustomerDocument = {
	personType: CustomerPersonType;
	documentType: CustomerDocumentType;
	documentNumber: string;
};

type ParsedCustomerIdentifier = ParsedCustomerDocument;

type ParsedCommissionInstallment = {
	installmentNumber: number;
	percentage: number;
	amount: number;
	status: SaleCommissionInstallmentStatus;
	expectedPaymentDateInput: string | null;
	preserveNullExpectedPaymentDate: boolean;
	paymentDateInput: string | null;
};

type ParsedCommissionGroup = {
	key: string;
	section: "unidade" | "vendedor" | "terceiros";
	externalType: string | null;
	externalId: string | null;
	name: string | null;
	email: string | null;
	installments: ParsedCommissionInstallment[];
};

type ParsedSaleJsonRow = {
	rowNumber: number;
	cota: SaleJsonImportCota;
	errors: string[];
	saleDateInput: string | null;
	status: SaleStatus | null;
	totalAmount: number | null;
	customerName: string | null;
	customerIdentifier: ParsedCustomerIdentifier | null;
	customerDocument: ParsedCustomerDocument | null;
	customerEmail: string | null;
	customerPhone: string | null;
	productId: string | null;
	unitGroupKey: string | null;
	responsibleGroupKey: string | null;
	commissionGroups: ParsedCommissionGroup[];
	dynamicFieldsInput: Record<string, unknown>;
};

type BeneficiaryResolution = {
	recipientType:
		| "COMPANY"
		| "UNIT"
		| "SELLER"
		| "PARTNER"
		| "SUPERVISOR"
		| "OTHER";
	beneficiaryId: string | null;
	label: string;
};

type ResponsibleResolution = {
	responsibleType: SaleResponsibleType;
	responsibleId: string | null;
	responsibleLabel: string | null;
};

function normalizeLookupValue(value: unknown) {
	const sanitized = sanitizeTextValue(value, { maxLength: 320 });
	if (!sanitized) {
		return "";
	}

	return sanitized
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.normalize("NFKC")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}

function normalizeIdentifier(value: unknown) {
	const sanitized = sanitizeTextValue(value, { maxLength: 120 });
	return sanitized ?? null;
}

function buildGroupKey(parts: unknown[]) {
	return parts.map((part) => normalizeLookupValue(part) || "-").join("|");
}

function parseCustomerDocument(
	rawValue: unknown,
): ParsedCustomerDocument | null {
	const digits = normalizeDocumentDigits(rawValue);
	if (!digits) {
		return null;
	}

	if (digits.length === 11 && isValidCpf(digits)) {
		return {
			personType: CustomerPersonType.PF,
			documentType: CustomerDocumentType.CPF,
			documentNumber: digits,
		};
	}

	if (digits.length === 14 && isValidCnpj(digits)) {
		return {
			personType: CustomerPersonType.PJ,
			documentType: CustomerDocumentType.CNPJ,
			documentNumber: digits,
		};
	}

	return null;
}

function parseCustomerIdentifier(params: {
	document: unknown;
	phone: unknown;
}): {
	identifier: ParsedCustomerIdentifier | null;
	document: ParsedCustomerDocument | null;
	phone: string | null;
	error: string | null;
} {
	const documentDigits = normalizeDocumentDigits(params.document);
	const phone = normalizePhoneDigits(params.phone);

	if (documentDigits) {
		const document = parseCustomerDocument(params.document);
		return {
			identifier: document,
			document,
			phone,
			error: document ? null : "CPF/CNPJ do cliente inválido",
		};
	}

	if (!phone) {
		return {
			identifier: null,
			document: null,
			phone: null,
			error: "CPF/CNPJ ou telefone do cliente é obrigatório",
		};
	}

	return {
		identifier: {
			personType: CustomerPersonType.PF,
			documentType: CustomerDocumentType.OTHER,
			documentNumber: phone,
		},
		document: null,
		phone,
		error: null,
	};
}

function parseSaleStatus(rawValue: unknown): SaleStatus | null {
	const normalized = normalizeLookupValue(rawValue);
	if (!normalized) {
		return SaleStatus.PENDING;
	}

	const statusByLabel = new Map<string, SaleStatus>([
		["nao confirmada", SaleStatus.PENDING],
		["não confirmada", SaleStatus.PENDING],
		["pendente", SaleStatus.PENDING],
		["pending", SaleStatus.PENDING],
		["confirmada", SaleStatus.COMPLETED],
		["aprovada", SaleStatus.COMPLETED],
		["approved", SaleStatus.COMPLETED],
		["concluida", SaleStatus.COMPLETED],
		["concluída", SaleStatus.COMPLETED],
		["completed", SaleStatus.COMPLETED],
		["cancelada", SaleStatus.CANCELED],
		["canceled", SaleStatus.CANCELED],
		["cancelled", SaleStatus.CANCELED],
	]);

	return statusByLabel.get(normalized) ?? null;
}

function parseSaleStatusFromCota(cota: SaleJsonImportCota) {
	const explicitSituation = getJsonField(cota, "situacao");
	const hasSituationValue = Boolean(
		sanitizeTextValue(explicitSituation, { maxLength: 120 }),
	);

	if (hasSituationValue) {
		return parseSaleStatus(explicitSituation);
	}

	return parseSaleStatus(cota.status);
}

function getJsonField(cota: SaleJsonImportCota, key: string) {
	return (cota as Record<string, unknown>)[key];
}

function parseCommissionAmountToCents(rawValue: unknown) {
	if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
		if (rawValue < 0) {
			return null;
		}
		return Math.round((rawValue + Number.EPSILON) * 100);
	}

	const value = sanitizeTextValue(rawValue, { maxLength: 120 });
	if (!value) {
		return null;
	}

	if (/^\d+$/.test(value)) {
		const parsedInteger = Number(value);
		if (!Number.isFinite(parsedInteger) || parsedInteger < 0) {
			return null;
		}
		return Math.round(parsedInteger * 100);
	}

	const normalized = value
		.replace(/\./g, "")
		.replace(/,/g, ".")
		.replace(/[^\d.-]/g, "");

	if (!normalized) {
		return null;
	}

	const parsedNumber = Number(normalized);
	if (!Number.isFinite(parsedNumber) || parsedNumber < 0) {
		return null;
	}

	return Math.round((parsedNumber + Number.EPSILON) * 100);
}

function parseNullableCommissionDate(rawValue: unknown) {
	const value = sanitizeTextValue(rawValue, { maxLength: 40 });
	if (!value || value === "0000-00-00") {
		return null;
	}

	return parseImportSaleDate(value);
}

function hasCommissionDateValue(rawValue: unknown) {
	const value = sanitizeTextValue(rawValue, { maxLength: 40 });
	return Boolean(value && value !== "0000-00-00");
}

function hasCommissionNumericSignal(rawValue: unknown) {
	if (rawValue === null || rawValue === undefined) {
		return false;
	}

	if (typeof rawValue === "number") {
		return Number.isFinite(rawValue) && rawValue !== 0;
	}

	const value = sanitizeTextValue(rawValue, { maxLength: 120 });
	if (!value) {
		return false;
	}

	const parsed = Number(value.replace(",", "."));
	if (!Number.isFinite(parsed)) {
		return true;
	}

	return parsed !== 0;
}

function hasCommissionAmountSignal(rawValue: unknown) {
	if (rawValue === null || rawValue === undefined) {
		return false;
	}

	if (typeof rawValue === "number") {
		return Number.isFinite(rawValue) && rawValue !== 0;
	}

	const value = sanitizeTextValue(rawValue, { maxLength: 120 });
	if (!value) {
		return false;
	}

	const amount = parseCommissionAmountToCents(rawValue);
	if (amount === null) {
		return true;
	}

	return amount !== 0;
}

function hasCommissionInstallmentMaterialSignal(rawValue: unknown) {
	if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
		return Boolean(sanitizeTextValue(rawValue, { maxLength: 120 }));
	}

	const item = rawValue as Record<string, unknown>;
	return (
		hasCommissionNumericSignal(item.porcentagem) ||
		hasCommissionAmountSignal(item.valor) ||
		Boolean(normalizeLookupValue(item.situacao)) ||
		hasCommissionDateValue(item.data_vencimento) ||
		hasCommissionDateValue(item.data_pagamento)
	);
}

function parseCommissionInstallmentStatus(
	rawValue: unknown,
): SaleCommissionInstallmentStatus | null {
	const normalized = normalizeLookupValue(rawValue);
	if (!normalized) {
		return SaleCommissionInstallmentStatus.PENDING;
	}

	const statusByLabel = new Map<string, SaleCommissionInstallmentStatus>([
		["pendente", SaleCommissionInstallmentStatus.PENDING],
		["pending", SaleCommissionInstallmentStatus.PENDING],
		["pago", SaleCommissionInstallmentStatus.PAID],
		["paga", SaleCommissionInstallmentStatus.PAID],
		["paid", SaleCommissionInstallmentStatus.PAID],
		["recebido", SaleCommissionInstallmentStatus.PAID],
		["recebida", SaleCommissionInstallmentStatus.PAID],
		["cancelado", SaleCommissionInstallmentStatus.CANCELED],
		["cancelada", SaleCommissionInstallmentStatus.CANCELED],
		["canceled", SaleCommissionInstallmentStatus.CANCELED],
		["cancelled", SaleCommissionInstallmentStatus.CANCELED],
	]);

	return statusByLabel.get(normalized) ?? null;
}

function parseCommissionInstallment(rawValue: unknown) {
	if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
		return null;
	}

	const item = rawValue as Record<string, unknown>;
	const installmentNumber = Number(item.parcela);
	const percentage = Number(item.porcentagem);
	const amount = parseCommissionAmountToCents(item.valor);
	const status = parseCommissionInstallmentStatus(item.situacao);
	const preserveNullExpectedPaymentDate =
		sanitizeTextValue(item.data_vencimento, { maxLength: 40 }) === "0000-00-00";
	const expectedPaymentDateInput = parseNullableCommissionDate(
		item.data_vencimento,
	);
	const paymentDateInput = parseNullableCommissionDate(item.data_pagamento);

	if (
		!Number.isInteger(installmentNumber) ||
		installmentNumber < 1 ||
		!Number.isFinite(percentage) ||
		percentage < 0 ||
		amount === null ||
		amount < 0 ||
		!status ||
		(hasCommissionDateValue(item.data_vencimento) &&
			!expectedPaymentDateInput) ||
		(hasCommissionDateValue(item.data_pagamento) && !paymentDateInput) ||
		(status === SaleCommissionInstallmentStatus.PAID && !paymentDateInput)
	) {
		return null;
	}

	return {
		installmentNumber,
		percentage,
		amount,
		status,
		expectedPaymentDateInput,
		preserveNullExpectedPaymentDate,
		paymentDateInput,
	};
}

function parseCommissionEntry(
	section: ParsedCommissionGroup["section"],
	rawValue: unknown,
): ParsedCommissionGroup | null {
	if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
		return null;
	}

	const entry = rawValue as Record<string, unknown>;
	const comissionado =
		entry.comissionado && typeof entry.comissionado === "object"
			? (entry.comissionado as Record<string, unknown>)
			: {};
	const installmentsRaw = Array.isArray(entry.comissoes) ? entry.comissoes : [];
	const installments = installmentsRaw
		.map(parseCommissionInstallment)
		.filter((installment) => installment !== null);

	if (installments.length === 0) {
		return null;
	}

	const externalType = sanitizeTextValue(comissionado.tipo, { maxLength: 80 });
	const externalId = normalizeIdentifier(comissionado.id);
	const name = sanitizeTextValue(comissionado.nome, { maxLength: 255 });
	const email = normalizeEmail(comissionado.email);
	const fallbackLabel = sanitizeTextValue(entry.nome, { maxLength: 255 });
	const resolvedName = name ?? fallbackLabel;

	const key = buildGroupKey([
		section,
		externalType,
		externalId,
		email,
		resolvedName,
	]);

	return {
		key,
		section,
		externalType,
		externalId,
		name: resolvedName,
		email,
		installments,
	};
}

function hasCommissionEntrySignal(rawValue: unknown) {
	if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
		return Boolean(sanitizeTextValue(rawValue, { maxLength: 120 }));
	}

	const entry = rawValue as Record<string, unknown>;
	if (Array.isArray(entry.comissoes)) {
		return entry.comissoes.some(hasCommissionInstallmentMaterialSignal);
	}

	if ("comissoes" in entry) {
		return Boolean(sanitizeTextValue(entry.comissoes, { maxLength: 120 }));
	}

	return hasCommissionInstallmentMaterialSignal(entry);
}

function isIgnorableDirectSellerCommissionPlaceholder(rawValue: unknown) {
	if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
		return false;
	}

	const entry = rawValue as Record<string, unknown>;
	if ("comissoes" in entry || "comissionado" in entry) {
		return false;
	}

	const installmentNumber = Number(entry.parcela);
	const percentage = Number(entry.porcentagem);
	const amount = parseCommissionAmountToCents(entry.valor);

	return (
		Number.isInteger(installmentNumber) &&
		installmentNumber >= 1 &&
		Number.isFinite(percentage) &&
		percentage === 0 &&
		amount === 0
	);
}

function parseDirectUnitCommissionGroup(
	cota: SaleJsonImportCota,
	entries: unknown[],
): ParsedCommissionGroup | null {
	const installments = entries
		.map(parseCommissionInstallment)
		.filter((installment) => installment !== null);

	if (installments.length === 0) {
		return null;
	}

	const unitName = sanitizeTextValue(cota.unidade, { maxLength: 255 });
	const externalType = "Unidade";
	const key = buildGroupKey(["unidade", externalType, null, null, unitName]);

	return {
		key,
		section: "unidade",
		externalType,
		externalId: null,
		name: unitName,
		email: null,
		installments,
	};
}

function parseCommissionGroups(cota: SaleJsonImportCota) {
	const sections = ["unidade", "vendedor", "terceiros"] as const;
	const commissions = cota.comissoes;
	const parsed: ParsedCommissionGroup[] = [];
	const errors: string[] = [];

	for (const section of sections) {
		const entries = Array.isArray(commissions?.[section])
			? commissions[section]
			: [];
		const entriesWithCommissionSignal = entries
			.map((entry, index) => ({ entry, index }))
			.filter(({ entry }) => {
				if (
					section === "vendedor" &&
					isIgnorableDirectSellerCommissionPlaceholder(entry)
				) {
					return false;
				}

				return hasCommissionEntrySignal(entry);
			});

		if (entriesWithCommissionSignal.length === 0) {
			continue;
		}

		if (
			section === "unidade" &&
			entries.some(
				(entry) =>
					hasCommissionInstallmentMaterialSignal(entry) &&
					parseCommissionInstallment(entry),
			)
		) {
			const parsedEntry = parseDirectUnitCommissionGroup(cota, entries);
			if (!parsedEntry) {
				errors.push("Comissão inválida em unidade");
			} else {
				parsed.push(parsedEntry);
			}
			continue;
		}

		for (const { entry, index } of entriesWithCommissionSignal) {
			const parsedEntry = parseCommissionEntry(section, entry);
			if (!parsedEntry) {
				errors.push(`Comissão inválida em ${section}[${index}]`);
				continue;
			}
			parsed.push(parsedEntry);
		}
	}

	return { parsed, errors };
}

async function buildPreviewContext(
	organizationId: string,
	body: SaleJsonImportPreviewBody,
) {
	const [products, companies, sellers, partners, supervisors] =
		await Promise.all([
			prisma.product.findMany({
				where: {
					organizationId,
					isActive: true,
				},
				select: {
					id: true,
					name: true,
					parentId: true,
					isActive: true,
				},
			}),
			prisma.company.findMany({
				where: {
					organizationId,
				},
				select: {
					id: true,
					name: true,
					units: {
						select: {
							id: true,
							name: true,
						},
					},
				},
			}),
			prisma.seller.findMany({
				where: {
					organizationId,
					status: SellerStatus.ACTIVE,
				},
				select: {
					id: true,
					name: true,
					email: true,
				},
			}),
			prisma.partner.findMany({
				where: {
					organizationId,
				},
				select: {
					id: true,
					name: true,
					companyName: true,
					email: true,
				},
			}),
			prisma.member.findMany({
				where: {
					organizationId,
					role: Role.SUPERVISOR,
				},
				select: {
					id: true,
					user: {
						select: {
							name: true,
							email: true,
						},
					},
				},
			}),
		]);

	const parentProduct = products.find(
		(product) => product.id === body.parentProductId,
	);
	if (!parentProduct) {
		throw new BadRequestError("Parent product not found or inactive");
	}

	return {
		products,
		companies,
		sellers,
		partners,
		supervisors,
		productResolver: buildProductResolver(products, {
			parentProductId: body.parentProductId,
		}),
	};
}

function resolveUnitSuggestions(context: PreviewContext, unitName: string) {
	const normalizedUnitName = normalizeLookupValue(unitName);
	if (!normalizedUnitName) {
		return [];
	}

	return context.companies.flatMap((company) =>
		company.units
			.filter((unit) => normalizeLookupValue(unit.name) === normalizedUnitName)
			.map((unit) => ({
				companyId: company.id,
				companyName: company.name,
				unitId: unit.id,
				unitName: unit.name,
			})),
	);
}

function resolveSellerSuggestions(
	context: PreviewContext,
	params: { name: string | null; email: string | null },
) {
	const normalizedName = normalizeLookupValue(params.name);
	const normalizedEmail = normalizeLookupValue(params.email);

	return context.sellers
		.filter((seller) => {
			const sellerName = normalizeLookupValue(seller.name);
			const sellerEmail = normalizeLookupValue(seller.email);
			return (
				(Boolean(normalizedEmail) && sellerEmail === normalizedEmail) ||
				(Boolean(normalizedName) && sellerName === normalizedName)
			);
		})
		.map((seller) => ({
			sellerId: seller.id,
			sellerName: seller.name,
			sellerEmail: seller.email,
		}));
}

function resolveBeneficiarySuggestions(
	context: PreviewContext,
	group: Pick<ParsedCommissionGroup, "name" | "email" | "section">,
) {
	const normalizedName = normalizeLookupValue(group.name);
	const normalizedEmail = normalizeLookupValue(group.email);
	const suggestions: Array<{
		type: string;
		id: string;
		label: string;
		email?: string | null;
	}> = [];

	for (const seller of context.sellers) {
		if (
			(normalizedEmail &&
				normalizeLookupValue(seller.email) === normalizedEmail) ||
			(normalizedName && normalizeLookupValue(seller.name) === normalizedName)
		) {
			suggestions.push({
				type: "SELLER",
				id: seller.id,
				label: seller.name,
				email: seller.email,
			});
		}
	}

	for (const partner of context.partners) {
		if (
			(normalizedEmail &&
				normalizeLookupValue(partner.email) === normalizedEmail) ||
			(normalizedName &&
				(normalizeLookupValue(partner.name) === normalizedName ||
					normalizeLookupValue(partner.companyName) === normalizedName))
		) {
			suggestions.push({
				type: "PARTNER",
				id: partner.id,
				label: getPartnerDisplayName(partner),
				email: partner.email,
			});
		}
	}

	for (const supervisor of context.supervisors) {
		const label = supervisor.user.name ?? supervisor.user.email;
		if (
			(normalizedEmail &&
				normalizeLookupValue(supervisor.user.email) === normalizedEmail) ||
			(normalizedName && normalizeLookupValue(label) === normalizedName)
		) {
			suggestions.push({
				type: "SUPERVISOR",
				id: supervisor.id,
				label,
				email: supervisor.user.email,
			});
		}
	}

	if (group.section === "unidade") {
		for (const company of context.companies) {
			if (
				normalizedName &&
				normalizeLookupValue(company.name) === normalizedName
			) {
				suggestions.push({
					type: "COMPANY",
					id: company.id,
					label: company.name,
					email: null,
				});
			}

			for (const unit of company.units) {
				if (
					normalizedName &&
					normalizeLookupValue(unit.name) === normalizedName
				) {
					suggestions.push({
						type: "UNIT",
						id: unit.id,
						label: `${company.name} -> ${unit.name}`,
						email: null,
					});
				}
			}
		}
	}

	return suggestions;
}

function parseJsonImportRows(
	body: SaleJsonImportPreviewBody,
	context: PreviewContext,
) {
	return body.cotas.map((cota, index): ParsedSaleJsonRow => {
		const rowNumber = index + 1;
		const errors: string[] = [];
		const saleDateInput = parseImportSaleDate(cota.data_pagamento);
		if (!saleDateInput) {
			errors.push("Data de pagamento inválida");
		}

		const status = parseSaleStatusFromCota(cota);
		if (!status) {
			errors.push("Status desconhecido");
		}

		const totalAmount = parseImportAmountToCents(cota.credito);
		if (!totalAmount || totalAmount <= 0) {
			errors.push("Crédito inválido");
		}

		const customerName = sanitizeTextValue(cota.cliente?.nome, {
			maxLength: 255,
		});
		if (!customerName) {
			errors.push("Nome do cliente é obrigatório");
		}

		const customerIdentifier = parseCustomerIdentifier({
			document: cota.cliente?.cpf_cnpj,
			phone: cota.cliente?.telefone,
		});
		if (customerIdentifier.error) {
			errors.push(customerIdentifier.error);
		}

		const productResolution = context.productResolver.resolve(cota.servico);
		const productId = productResolution.ok ? productResolution.productId : null;
		if (!productResolution.ok) {
			errors.push(productResolution.message);
		}

		const unitName = sanitizeTextValue(cota.unidade, { maxLength: 255 });
		const unitGroupKey = unitName ? buildGroupKey(["unit", unitName]) : null;
		if (!unitGroupKey) {
			errors.push("Unidade é obrigatória");
		}

		const sellerName = sanitizeTextValue(cota.vendedor?.nome, {
			maxLength: 255,
		});
		const sellerEmail = normalizeEmail(cota.vendedor?.email);
		const responsibleGroupKey =
			sellerName || sellerEmail
				? buildGroupKey(["seller", sellerEmail, sellerName, unitName])
				: null;

		const commissions = parseCommissionGroups(cota);
		errors.push(...commissions.errors);

		const dynamicFieldsInput = Object.fromEntries(
			body.dynamicFieldMappings.map((mapping) => [
				mapping.fieldId,
				getJsonField(cota, mapping.jsonKey),
			]),
		);

		return {
			rowNumber,
			cota,
			errors,
			saleDateInput,
			status,
			totalAmount,
			customerName,
			customerIdentifier: customerIdentifier.identifier,
			customerDocument: customerIdentifier.document,
			customerEmail: normalizeEmail(cota.cliente?.email),
			customerPhone: customerIdentifier.phone,
			productId,
			unitGroupKey,
			responsibleGroupKey,
			commissionGroups: commissions.parsed,
			dynamicFieldsInput,
		};
	});
}

export async function previewSaleJsonImport(
	organizationId: string,
	body: SaleJsonImportPreviewBody,
) {
	const context = await buildPreviewContext(organizationId, body);
	const parsedRows = parseJsonImportRows(body, context);

	const unitGroupsByKey = new Map<string, { key: string; name: string }>();
	const responsibleGroupsByKey = new Map<
		string,
		{
			key: string;
			name: string | null;
			email: string | null;
			unitName: string | null;
		}
	>();
	const commissionGroupsByKey = new Map<
		ParsedCommissionGroup["key"],
		ParsedCommissionGroup
	>();

	for (const row of parsedRows) {
		const unitName = sanitizeTextValue(row.cota.unidade, { maxLength: 255 });
		if (row.unitGroupKey && unitName) {
			unitGroupsByKey.set(row.unitGroupKey, {
				key: row.unitGroupKey,
				name: unitName,
			});
		}

		if (row.responsibleGroupKey) {
			responsibleGroupsByKey.set(row.responsibleGroupKey, {
				key: row.responsibleGroupKey,
				name: sanitizeTextValue(row.cota.vendedor?.nome, { maxLength: 255 }),
				email: normalizeEmail(row.cota.vendedor?.email),
				unitName,
			});
		}

		for (const group of row.commissionGroups) {
			commissionGroupsByKey.set(group.key, group);
		}
	}

	const unitGroups = Array.from(unitGroupsByKey.values()).map((group) => ({
		...group,
		suggestions: resolveUnitSuggestions(context, group.name),
	}));
	const responsibleGroups = Array.from(responsibleGroupsByKey.values()).map(
		(group) => ({
			...group,
			suggestions: resolveSellerSuggestions(context, {
				name: group.name,
				email: group.email,
			}),
		}),
	);
	const commissionBeneficiaryGroups = Array.from(
		commissionGroupsByKey.values(),
	).map((group) => ({
		key: group.key,
		section: group.section,
		externalType: group.externalType,
		externalId: group.externalId,
		name: group.name,
		email: group.email,
		suggestions: resolveBeneficiarySuggestions(context, group),
	}));
	const invalidRows = parsedRows.filter((row) => row.errors.length > 0).length;

	return {
		totalRows: parsedRows.length,
		validRows: parsedRows.length - invalidRows,
		invalidRows,
		hasCommissions: parsedRows.some((row) => row.commissionGroups.length > 0),
		unitGroups,
		responsibleGroups,
		commissionBeneficiaryGroups,
		rows: parsedRows.map((row) => ({
			rowNumber: row.rowNumber,
			isValid: row.errors.length === 0,
			errors: row.errors,
			saleDate: row.saleDateInput,
			status: row.status,
			totalAmount: row.totalAmount,
			customerDocument: row.customerDocument?.documentNumber ?? null,
			productId: row.productId,
			unitGroupKey: row.unitGroupKey,
			responsibleGroupKey: row.responsibleGroupKey,
			commissionBeneficiaryKeys: row.commissionGroups.map((group) => group.key),
		})),
	};
}

async function resolveCustomerId(
	tx: Prisma.TransactionClient,
	params: {
		organizationId: string;
		name: string;
		identifier: ParsedCustomerIdentifier;
		email: string | null;
		phone: string | null;
	},
) {
	const existingCustomer = await tx.customer.findUnique({
		where: {
			organizationId_documentType_documentNumber: {
				organizationId: params.organizationId,
				documentType: params.identifier.documentType,
				documentNumber: params.identifier.documentNumber,
			},
		},
		select: {
			id: true,
			status: true,
		},
	});

	if (existingCustomer) {
		if (existingCustomer.status !== CustomerStatus.ACTIVE) {
			throw new BadRequestError(
				"Cliente encontrado por documento está inativo",
			);
		}

		return existingCustomer.id;
	}

	const createdCustomer = await tx.customer.create({
		data: {
			organizationId: params.organizationId,
			personType: params.identifier.personType,
			documentType: params.identifier.documentType,
			documentNumber: params.identifier.documentNumber,
			name: params.name,
			email: params.email,
			phone: params.phone,
			status: CustomerStatus.ACTIVE,
		},
		select: {
			id: true,
		},
	});

	return createdCustomer.id;
}

async function loadBeneficiaryResolutions(
	organizationId: string,
	resolutions: SaleJsonImportApplyBody["commissionBeneficiaryResolutions"],
) {
	const byKey = new Map<string, BeneficiaryResolution>();

	for (const resolution of resolutions) {
		if (resolution.recipientType === "OTHER") {
			byKey.set(resolution.key, {
				recipientType: "OTHER",
				beneficiaryId: null,
				label: resolution.beneficiaryLabel ?? "Outro comissionado",
			});
			continue;
		}

		const beneficiaryId = resolution.beneficiaryId;
		if (!beneficiaryId) {
			throw new BadRequestError("Comissionado não selecionado");
		}

		if (resolution.recipientType === "COMPANY") {
			const company = await prisma.company.findFirst({
				where: { id: beneficiaryId, organizationId },
				select: { id: true, name: true },
			});
			if (!company) {
				throw new BadRequestError("Empresa comissionada não encontrada");
			}
			byKey.set(resolution.key, {
				recipientType: "COMPANY",
				beneficiaryId: company.id,
				label: company.name,
			});
			continue;
		}

		if (resolution.recipientType === "UNIT") {
			const unit = await prisma.unit.findFirst({
				where: {
					id: beneficiaryId,
					company: { organizationId },
				},
				select: {
					id: true,
					name: true,
					company: { select: { name: true } },
				},
			});
			if (!unit) {
				throw new BadRequestError("Unidade comissionada não encontrada");
			}
			byKey.set(resolution.key, {
				recipientType: "UNIT",
				beneficiaryId: unit.id,
				label: `${unit.company.name} -> ${unit.name}`,
			});
			continue;
		}

		if (resolution.recipientType === "SELLER") {
			const seller = await prisma.seller.findFirst({
				where: {
					id: beneficiaryId,
					organizationId,
					status: SellerStatus.ACTIVE,
				},
				select: { id: true, name: true },
			});
			if (!seller) {
				throw new BadRequestError("Vendedor comissionado não encontrado");
			}
			byKey.set(resolution.key, {
				recipientType: "SELLER",
				beneficiaryId: seller.id,
				label: seller.name,
			});
			continue;
		}

		if (resolution.recipientType === "PARTNER") {
			const partner = await prisma.partner.findFirst({
				where: { id: beneficiaryId, organizationId },
				select: { id: true, name: true, companyName: true },
			});
			if (!partner) {
				throw new BadRequestError("Parceiro comissionado não encontrado");
			}
			byKey.set(resolution.key, {
				recipientType: "PARTNER",
				beneficiaryId: partner.id,
				label: getPartnerDisplayName(partner),
			});
			continue;
		}

		const supervisor = await prisma.member.findFirst({
			where: {
				id: beneficiaryId,
				organizationId,
				role: Role.SUPERVISOR,
			},
			select: {
				id: true,
				user: { select: { name: true, email: true } },
			},
		});
		if (!supervisor) {
			throw new BadRequestError("Supervisor comissionado não encontrado");
		}
		byKey.set(resolution.key, {
			recipientType: "SUPERVISOR",
			beneficiaryId: supervisor.id,
			label: supervisor.user.name ?? supervisor.user.email,
		});
	}

	return byKey;
}

function getCommissionBeneficiaryCreateData(resolution: BeneficiaryResolution) {
	return {
		beneficiaryCompanyId:
			resolution.recipientType === "COMPANY" ? resolution.beneficiaryId : null,
		beneficiaryUnitId:
			resolution.recipientType === "UNIT" ? resolution.beneficiaryId : null,
		beneficiarySellerId:
			resolution.recipientType === "SELLER" ? resolution.beneficiaryId : null,
		beneficiaryPartnerId:
			resolution.recipientType === "PARTNER" ? resolution.beneficiaryId : null,
		beneficiarySupervisorId:
			resolution.recipientType === "SUPERVISOR"
				? resolution.beneficiaryId
				: null,
		beneficiaryLabel: resolution.label,
	};
}

function normalizeResponsibleResolution(
	resolution:
		| SaleJsonImportApplyBody["responsibleResolutions"][number]
		| undefined,
): ResponsibleResolution | null {
	if (!resolution) {
		return null;
	}

	if (resolution.sellerId) {
		return {
			responsibleType: SaleResponsibleType.SELLER,
			responsibleId: resolution.sellerId,
			responsibleLabel: null,
		};
	}

	if (resolution.type === SaleResponsibleType.OTHER) {
		if (!resolution.label) {
			return null;
		}

		return {
			responsibleType: SaleResponsibleType.OTHER,
			responsibleId: null,
			responsibleLabel: resolution.label,
		};
	}

	if (!resolution.type || !resolution.id) {
		return null;
	}

	return {
		responsibleType: resolution.type,
		responsibleId: resolution.id,
		responsibleLabel: null,
	};
}

async function resolveResponsibleResolution(
	tx: Prisma.TransactionClient,
	params: {
		organizationId: string;
		resolution: ResponsibleResolution | null;
	},
) {
	if (!params.resolution) {
		return {
			responsibleType: null,
			responsibleId: null,
			responsibleLabel: null,
		};
	}

	if (params.resolution.responsibleType === SaleResponsibleType.COMPANY) {
		const company = await tx.company.findFirst({
			where: {
				id: params.resolution.responsibleId ?? "",
				organizationId: params.organizationId,
			},
			select: { id: true },
		});
		if (!company) {
			throw new BadRequestError("Empresa responsável não encontrada");
		}

		return {
			responsibleType: SaleResponsibleType.COMPANY,
			responsibleId: company.id,
			responsibleLabel: null,
		};
	}

	if (params.resolution.responsibleType === SaleResponsibleType.UNIT) {
		const unit = await tx.unit.findFirst({
			where: {
				id: params.resolution.responsibleId ?? "",
				company: { organizationId: params.organizationId },
			},
			select: { id: true },
		});
		if (!unit) {
			throw new BadRequestError("Unidade responsável não encontrada");
		}

		return {
			responsibleType: SaleResponsibleType.UNIT,
			responsibleId: unit.id,
			responsibleLabel: null,
		};
	}

	if (params.resolution.responsibleType === SaleResponsibleType.SELLER) {
		const seller = await tx.seller.findFirst({
			where: {
				id: params.resolution.responsibleId ?? "",
				organizationId: params.organizationId,
				status: SellerStatus.ACTIVE,
			},
			select: { id: true },
		});
		if (!seller) {
			throw new BadRequestError("Vendedor responsável não encontrado");
		}

		return {
			responsibleType: SaleResponsibleType.SELLER,
			responsibleId: seller.id,
			responsibleLabel: null,
		};
	}

	if (params.resolution.responsibleType === SaleResponsibleType.PARTNER) {
		const partner = await tx.partner.findFirst({
			where: {
				id: params.resolution.responsibleId ?? "",
				organizationId: params.organizationId,
				status: PartnerStatus.ACTIVE,
			},
			select: { id: true },
		});
		if (!partner) {
			throw new BadRequestError("Parceiro responsável não encontrado");
		}

		return {
			responsibleType: SaleResponsibleType.PARTNER,
			responsibleId: partner.id,
			responsibleLabel: null,
		};
	}

	if (params.resolution.responsibleType === SaleResponsibleType.SUPERVISOR) {
		const supervisor = await tx.member.findFirst({
			where: {
				id: params.resolution.responsibleId ?? "",
				organizationId: params.organizationId,
				role: Role.SUPERVISOR,
			},
			select: { id: true },
		});
		if (!supervisor) {
			throw new BadRequestError("Supervisor responsável não encontrado");
		}

		return {
			responsibleType: SaleResponsibleType.SUPERVISOR,
			responsibleId: supervisor.id,
			responsibleLabel: null,
		};
	}

	return {
		responsibleType: SaleResponsibleType.OTHER,
		responsibleId: null,
		responsibleLabel: params.resolution.responsibleLabel ?? "Outro responsável",
	};
}

export async function applySaleJsonImport(params: {
	organizationId: string;
	actorId: string;
	body: SaleJsonImportApplyBody;
}) {
	const { organizationId, actorId, body } = params;
	const context = await buildPreviewContext(organizationId, body);
	const parsedRows = parseJsonImportRows(body, context);
	const unitResolutionsByKey = new Map(
		body.unitResolutions.map((resolution) => [resolution.key, resolution]),
	);
	const responsibleResolutionsByKey = new Map(
		body.responsibleResolutions.map((resolution) => [
			resolution.key,
			resolution,
		]),
	);
	const beneficiaryResolutionsByKey = await loadBeneficiaryResolutions(
		organizationId,
		body.commissionBeneficiaryResolutions,
	);

	const createdSaleIds: string[] = [];
	const failures: Array<{ rowNumber: number; code: string; message: string }> =
		[];

	for (const row of parsedRows) {
		try {
			if (row.errors.length > 0) {
				throw new BadRequestError(row.errors.join("; "));
			}
			if (
				!row.saleDateInput ||
				!row.status ||
				!row.totalAmount ||
				!row.customerName ||
				!row.customerIdentifier ||
				!row.productId ||
				!row.unitGroupKey
			) {
				throw new BadRequestError("Linha inválida");
			}
			const saleDateInput = row.saleDateInput;
			const status = row.status;
			const totalAmount = row.totalAmount;
			const customerName = row.customerName;
			const customerIdentifier = row.customerIdentifier;
			const productId = row.productId;

			const unitResolution = unitResolutionsByKey.get(row.unitGroupKey);
			if (!unitResolution) {
				throw new BadRequestError("Selecione a unidade da venda");
			}

			for (const commissionGroup of row.commissionGroups) {
				if (!beneficiaryResolutionsByKey.has(commissionGroup.key)) {
					throw new BadRequestError("Selecione todos os comissionados");
				}
			}

			const sale = await db(() =>
				prisma.$transaction(async (tx) => {
					const company = await tx.company.findFirst({
						where: {
							id: unitResolution.companyId,
							organizationId,
						},
						select: { id: true },
					});
					if (!company) {
						throw new BadRequestError("Empresa da venda não encontrada");
					}

					if (unitResolution.unitId) {
						const unit = await tx.unit.findFirst({
							where: {
								id: unitResolution.unitId,
								companyId: unitResolution.companyId,
							},
							select: { id: true },
						});
						if (!unit) {
							throw new BadRequestError("Unidade da venda não encontrada");
						}
					}

					const responsibleResolution = normalizeResponsibleResolution(
						(row.responsibleGroupKey
							? responsibleResolutionsByKey.get(row.responsibleGroupKey)
							: undefined) ??
							(row.unitGroupKey
								? responsibleResolutionsByKey.get(row.unitGroupKey)
								: undefined),
					);
					const responsibleData = await resolveResponsibleResolution(tx, {
						organizationId,
						resolution: responsibleResolution,
					});

					const customerId = await resolveCustomerId(tx, {
						organizationId,
						name: customerName,
						identifier: customerIdentifier,
						email: row.customerEmail,
						phone: row.customerPhone,
					});

					const dynamicFieldSchema = await loadProductSaleFieldSchema(
						tx,
						productId,
					);
					const dynamicInput = Object.fromEntries(
						dynamicFieldSchema.flatMap((field) => {
							if (
								!Object.prototype.hasOwnProperty.call(
									row.dynamicFieldsInput,
									field.fieldId,
								)
							) {
								return [];
							}

							return [
								[
									field.fieldId,
									mapDynamicImportRawValue(
										field,
										row.dynamicFieldsInput[field.fieldId],
									),
								],
							];
						}),
					);
					const dynamicFieldValues = normalizeSaleDynamicFieldValues({
						schema: dynamicFieldSchema,
						input: dynamicInput,
					});

					const createdSale = await tx.sale.create({
						data: {
							organizationId,
							companyId: unitResolution.companyId,
							unitId: unitResolution.unitId,
							customerId,
							productId,
							saleDate: parseSaleDateInput(saleDateInput),
							totalAmount,
							status,
							...responsibleData,
							notes: null,
							dynamicFieldSchema:
								dynamicFieldSchema as unknown as Prisma.InputJsonValue,
							dynamicFieldValues:
								dynamicFieldValues as unknown as Prisma.InputJsonValue,
							createdById: actorId,
						},
					});

					for (const [
						commissionIndex,
						commissionGroup,
					] of row.commissionGroups.entries()) {
						const resolution = beneficiaryResolutionsByKey.get(
							commissionGroup.key,
						);
						if (!resolution) {
							throw new BadRequestError("Comissionado não selecionado");
						}

						const totalPercentage = commissionGroup.installments.reduce(
							(sum, installment) =>
								sum + toScaledPercentage(installment.percentage),
							0,
						);
						if (totalPercentage <= 0) {
							throw new BadRequestError("Percentual de comissão inválido");
						}

						const startDate = parseSaleDateInput(saleDateInput);
						await tx.saleCommission.create({
							data: {
								saleId: createdSale.id,
								sourceType: "MANUAL",
								recipientType: resolution.recipientType,
								direction: deriveSaleCommissionDirectionFromRecipientType(
									resolution.recipientType,
								),
								calculationBase: "SALE_TOTAL",
								useAdvancedDateSchedule: false,
								baseCommissionId: null,
								...getCommissionBeneficiaryCreateData(resolution),
								startDate,
								totalPercentage,
								sortOrder: commissionIndex,
								installments: {
									create: commissionGroup.installments.map((installment) => ({
										installmentNumber: installment.installmentNumber,
										percentage: toScaledPercentage(installment.percentage),
										amount: installment.amount,
										monthsToAdvance:
											installment.installmentNumber <= 1
												? 0
												: installment.installmentNumber - 1,
										status: installment.status,
										expectedPaymentDate:
											installment.preserveNullExpectedPaymentDate
												? null
												: installment.expectedPaymentDateInput
													? parseSaleDateInput(
															installment.expectedPaymentDateInput,
														)
													: addMonths(
															startDate,
															Math.max(0, installment.installmentNumber - 1),
														),
										paymentDate: installment.paymentDateInput
											? parseSaleDateInput(installment.paymentDateInput)
											: null,
									})),
								},
							},
						});
					}

					const snapshot = await loadSaleHistorySnapshot(
						tx,
						createdSale.id,
						organizationId,
					);
					if (!snapshot) {
						throw new BadRequestError("Sale not found");
					}

					await createSaleCreatedHistoryEvent(tx, {
						saleId: createdSale.id,
						organizationId,
						actorId,
						snapshot,
					});

					return createdSale;
				}),
			);

			createdSaleIds.push(sale.id);
		} catch (error) {
			failures.push({
				rowNumber: row.rowNumber,
				code:
					error instanceof BadRequestError
						? "VALIDATION_ERROR"
						: "UNEXPECTED_ERROR",
				message: error instanceof Error ? error.message : "Erro inesperado",
			});
		}
	}

	return {
		totalRows: parsedRows.length,
		importedRows: createdSaleIds.length,
		failedRows: failures.length,
		createdSaleIds,
		failures,
	};
}
