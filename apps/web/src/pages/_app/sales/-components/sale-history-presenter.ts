import { format, parse, parseISO } from "date-fns";
import type {
	GetOrganizationsSlugSalesSaleidHistory200,
	HistoryActionEnumKey,
} from "@/http/generated";
import {
	SALE_COMMISSION_DIRECTION_LABEL,
	SALE_COMMISSION_INSTALLMENT_STATUS_LABEL,
	SALE_COMMISSION_RECIPIENT_TYPE_LABEL,
	SALE_COMMISSION_SOURCE_TYPE_LABEL,
	SALE_RESPONSIBLE_TYPE_LABEL,
	SALE_STATUS_LABEL,
	type SaleCommissionDirection,
	type SaleCommissionInstallmentStatus,
	type SaleCommissionRecipientType,
	type SaleCommissionSourceType,
	type SaleResponsibleType,
	type SaleStatus,
} from "@/schemas/types/sales";
import { formatCurrencyBRL } from "@/utils/format-amount";
import {
	formatSaleDynamicFieldValue,
	isSaleDynamicFieldHistoryValue,
} from "./sale-dynamic-fields";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const SALE_PATH_REGEX = /^sale\.(.+)$/;
const DYNAMIC_FIELD_PATH_REGEX = /^sale\.dynamicFieldValues\.([^.]+)$/;
const COMMISSION_PATH_REGEX = /^commissions\[(\d+)\]\.(.+)$/;
const INSTALLMENT_PATH_REGEX =
	/^commissions\[(\d+)\]\.installments\[(\d+)\]\.(.+)$/;

const SALE_FIELD_LABEL: Record<string, string> = {
	totalAmount: "valor total",
	pendingCommissionInstallmentsUpdatedCount:
		"parcelas pendentes de comissão atualizadas",
	paidCommissionInstallmentsReversedCount:
		"parcelas pagas de comissão estornadas",
	status: "status",
	saleDate: "data da venda",
	notes: "observação",
	companyId: "empresa",
	unitId: "unidade",
	customerId: "cliente",
	productId: "produto",
	responsibleType: "tipo de responsável",
	responsibleId: "responsável",
};

const COMMISSION_FIELD_LABEL: Record<string, string> = {
	id: "identificador da comissão",
	sourceType: "origem da comissão",
	recipientType: "tipo de beneficiário",
	direction: "direção da comissão",
	calculationBase: "base de cálculo",
	baseCommissionIndex: "comissão base",
	beneficiaryCompanyId: "empresa beneficiária",
	beneficiaryUnitId: "unidade beneficiária",
	beneficiarySellerId: "vendedor beneficiário",
	beneficiaryPartnerId: "parceiro beneficiário",
	beneficiarySupervisorId: "supervisor beneficiário",
	beneficiaryLabel: "beneficiário",
	startDate: "início da comissão",
	totalPercentage: "percentual total",
	sortOrder: "ordem da comissão",
};

const INSTALLMENT_FIELD_LABEL: Record<string, string> = {
	id: "identificador da parcela",
	installmentNumber: "número da parcela",
	percentage: "percentual da parcela",
	amount: "valor da parcela",
	status: "status da parcela",
	expectedPaymentDate: "data prevista de pagamento",
	paymentDate: "data de pagamento",
};

export const SALE_HISTORY_ACTION_LABEL: Record<HistoryActionEnumKey, string> = {
	CREATED: "Venda criada",
	UPDATED: "Venda atualizada",
	STATUS_CHANGED: "Status alterado",
	COMMISSION_INSTALLMENT_UPDATED: "Parcela atualizada",
	COMMISSION_INSTALLMENT_STATUS_UPDATED: "Status da parcela alterado",
	COMMISSION_INSTALLMENT_DELETED: "Parcela removida",
};

export type SaleHistoryEvent =
	GetOrganizationsSlugSalesSaleidHistory200["history"][number];
type SaleHistoryChange = SaleHistoryEvent["changes"][number];

export type SaleHistoryTimelineEvent = {
	id: string;
	action: HistoryActionEnumKey;
	title: string;
	createdAt: string;
	actor: SaleHistoryEvent["actor"];
	messages: string[];
};

type ParsedHistoryPath =
	| {
			type: "sale";
			field: string;
	  }
	| {
			type: "dynamicField";
			fieldId: string;
	  }
	| {
			type: "commission";
			commissionIndex: number;
			field: string;
	  }
	| {
			type: "installment";
			commissionIndex: number;
			installmentIndex: number;
			field: string;
	  }
	| {
			type: "unknown";
			field: string;
			rawPath: string;
	  };

function formatDateOnly(value: string) {
	return format(parse(value, "yyyy-MM-dd", new Date()), "dd/MM/yyyy");
}

function formatDateTime(value: string) {
	return format(parseISO(value), "dd/MM/yyyy HH:mm");
}

function formatPercentage(value: number) {
	return `${new Intl.NumberFormat("pt-BR", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 4,
	}).format(value)}%`;
}

function formatNullableValue(value: unknown) {
	if (value === null || value === undefined) {
		return "vazio";
	}

	if (typeof value === "string" && value.length === 0) {
		return "vazio";
	}

	return value;
}

function toFriendlyFieldName(field: string) {
	const cleanedField = field.replace(/\[\d+\]/g, "");
	return cleanedField
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/\./g, " ")
		.toLowerCase();
}

function getSaleStatusLabel(value: unknown) {
	if (typeof value !== "string") {
		return String(value);
	}

	return SALE_STATUS_LABEL[value as SaleStatus] ?? value;
}

function getInstallmentStatusLabel(value: unknown) {
	if (typeof value !== "string") {
		return String(value);
	}

	return (
		SALE_COMMISSION_INSTALLMENT_STATUS_LABEL[
			value as SaleCommissionInstallmentStatus
		] ?? value
	);
}

function getResponsibleTypeLabel(value: unknown) {
	if (typeof value !== "string") {
		return String(value);
	}

	return SALE_RESPONSIBLE_TYPE_LABEL[value as SaleResponsibleType] ?? value;
}

function getSourceTypeLabel(value: unknown) {
	if (typeof value !== "string") {
		return String(value);
	}

	return SALE_COMMISSION_SOURCE_TYPE_LABEL[value as SaleCommissionSourceType] ?? value;
}

function getRecipientTypeLabel(value: unknown) {
	if (typeof value !== "string") {
		return String(value);
	}

	return (
		SALE_COMMISSION_RECIPIENT_TYPE_LABEL[value as SaleCommissionRecipientType] ??
		value
	);
}

function getDirectionLabel(value: unknown) {
	if (typeof value !== "string") {
		return String(value);
	}

	return SALE_COMMISSION_DIRECTION_LABEL[value as SaleCommissionDirection] ?? value;
}

function parseHistoryPath(path: string): ParsedHistoryPath {
	const dynamicFieldMatch = path.match(DYNAMIC_FIELD_PATH_REGEX);
	if (dynamicFieldMatch) {
		return {
			type: "dynamicField",
			fieldId: dynamicFieldMatch[1] ?? "",
		};
	}

	const installmentMatch = path.match(INSTALLMENT_PATH_REGEX);
	if (installmentMatch) {
		return {
			type: "installment",
			commissionIndex: Number(installmentMatch[1]),
			installmentIndex: Number(installmentMatch[2]),
			field: installmentMatch[3] ?? "",
		};
	}

	const commissionMatch = path.match(COMMISSION_PATH_REGEX);
	if (commissionMatch) {
		return {
			type: "commission",
			commissionIndex: Number(commissionMatch[1]),
			field: commissionMatch[2] ?? "",
		};
	}

	const saleMatch = path.match(SALE_PATH_REGEX);
	if (saleMatch) {
		return {
			type: "sale",
			field: saleMatch[1] ?? "",
		};
	}

	return {
		type: "unknown",
		field: path.split(".").at(-1) ?? path,
		rawPath: path,
	};
}

function formatChangeValue(value: unknown, parsedPath: ParsedHistoryPath) {
	const normalizedValue = formatNullableValue(value);

	if (normalizedValue === "vazio") {
		return normalizedValue;
	}

	if (parsedPath.type === "sale") {
		if (parsedPath.field === "totalAmount" && typeof normalizedValue === "number") {
			return formatCurrencyBRL(normalizedValue / 100);
		}

		if (parsedPath.field === "status") {
			return getSaleStatusLabel(normalizedValue);
		}

		if (parsedPath.field === "responsibleType") {
			return getResponsibleTypeLabel(normalizedValue);
		}

		if (parsedPath.field === "saleDate" && typeof normalizedValue === "string") {
			return formatDateOnly(normalizedValue);
		}
	}

	if (parsedPath.type === "commission") {
		if (
			parsedPath.field === "totalPercentage" &&
			typeof normalizedValue === "number"
		) {
			return formatPercentage(normalizedValue);
		}

		if (parsedPath.field === "startDate" && typeof normalizedValue === "string") {
			return formatDateOnly(normalizedValue);
		}

		if (parsedPath.field === "sourceType") {
			return getSourceTypeLabel(normalizedValue);
		}

		if (parsedPath.field === "recipientType") {
			return getRecipientTypeLabel(normalizedValue);
		}

		if (parsedPath.field === "direction") {
			return getDirectionLabel(normalizedValue);
		}

		if (parsedPath.field === "calculationBase") {
			if (normalizedValue === "COMMISSION") {
				return "Comissão";
			}

			if (normalizedValue === "SALE_TOTAL") {
				return "Valor da venda";
			}
		}
	}

	if (parsedPath.type === "installment") {
		if (parsedPath.field === "amount" && typeof normalizedValue === "number") {
			return formatCurrencyBRL(normalizedValue / 100);
		}

		if (parsedPath.field === "percentage" && typeof normalizedValue === "number") {
			return formatPercentage(normalizedValue);
		}

		if (parsedPath.field === "status") {
			return getInstallmentStatusLabel(normalizedValue);
		}

		if (
			(parsedPath.field === "expectedPaymentDate" ||
				parsedPath.field === "paymentDate") &&
			typeof normalizedValue === "string"
		) {
			return formatDateOnly(normalizedValue);
		}
	}

	if (typeof normalizedValue === "boolean") {
		return normalizedValue ? "sim" : "não";
	}

	if (typeof normalizedValue === "number") {
		return new Intl.NumberFormat("pt-BR").format(normalizedValue);
	}

	if (typeof normalizedValue === "string") {
		if (DATE_ONLY_REGEX.test(normalizedValue)) {
			return formatDateOnly(normalizedValue);
		}

		if (ISO_DATE_TIME_REGEX.test(normalizedValue)) {
			return formatDateTime(normalizedValue);
		}

		return normalizedValue;
	}

	if (Array.isArray(normalizedValue) || typeof normalizedValue === "object") {
		return JSON.stringify(normalizedValue);
	}

	return String(normalizedValue);
}

function buildFallbackSentence(
	fieldName: string,
	beforeValue: string,
	afterValue: string,
) {
	return `Campo ${fieldName} alterado de ${beforeValue} para ${afterValue}.`;
}

function toSentenceLabel(value: string) {
	const normalized = value.trim();
	if (!normalized) {
		return "Campo personalizado";
	}

	return normalized.slice(0, 1).toUpperCase() + normalized.slice(1);
}

function formatDynamicFieldChange(change: SaleHistoryChange, fieldId: string) {
	const beforeHistoryValue = isSaleDynamicFieldHistoryValue(change.before)
		? change.before
		: null;
	const afterHistoryValue = isSaleDynamicFieldHistoryValue(change.after)
		? change.after
		: null;

	const fieldLabel =
		afterHistoryValue?.label ??
		beforeHistoryValue?.label ??
		`Campo personalizado ${fieldId.slice(0, 8)}`;
	const dynamicFieldDescriptor = {
		type: afterHistoryValue?.type ?? beforeHistoryValue?.type ?? "TEXT",
		options: afterHistoryValue?.options ?? beforeHistoryValue?.options ?? [],
	};

	const beforeValue = formatSaleDynamicFieldValue(
		dynamicFieldDescriptor,
		beforeHistoryValue ? beforeHistoryValue.value : change.before,
	);
	const afterValue = formatSaleDynamicFieldValue(
		dynamicFieldDescriptor,
		afterHistoryValue ? afterHistoryValue.value : change.after,
	);

	return `${toSentenceLabel(fieldLabel)} alterado de ${beforeValue} para ${afterValue}.`;
}

function formatSaleChange(change: SaleHistoryChange, field: string) {
	const beforeValue = formatChangeValue(change.before, {
		type: "sale",
		field,
	});
	const afterValue = formatChangeValue(change.after, {
		type: "sale",
		field,
	});

	switch (field) {
		case "totalAmount":
			return `Valor total alterado de ${beforeValue} para ${afterValue}.`;
		case "pendingCommissionInstallmentsUpdatedCount": {
			const updatedInstallmentsCount =
				typeof change.after === "number" ? change.after : null;

			if (updatedInstallmentsCount && updatedInstallmentsCount > 0) {
				return `Parcelas pendentes de comissão foram atualizadas (${updatedInstallmentsCount}).`;
			}

			return "Parcelas pendentes de comissão foram atualizadas.";
		}
		case "paidCommissionInstallmentsReversedCount": {
			const reversedInstallmentsCount =
				typeof change.after === "number" ? change.after : null;

			if (reversedInstallmentsCount && reversedInstallmentsCount > 0) {
				return `Parcelas pagas de comissão foram estornadas (${reversedInstallmentsCount}).`;
			}

			return "Parcelas pagas de comissão foram estornadas.";
		}
		case "status":
			return `Status alterado de ${beforeValue} para ${afterValue}.`;
		case "saleDate":
			return `Data da venda alterada de ${beforeValue} para ${afterValue}.`;
		case "notes":
			return `Observação alterada de ${beforeValue} para ${afterValue}.`;
		case "companyId":
			return `Empresa alterada de ${beforeValue} para ${afterValue}.`;
		case "unitId":
			return `Unidade alterada de ${beforeValue} para ${afterValue}.`;
		case "customerId":
			return `Cliente alterado de ${beforeValue} para ${afterValue}.`;
		case "productId":
			return `Produto alterado de ${beforeValue} para ${afterValue}.`;
		case "responsibleType":
			return `Tipo de responsável alterado de ${beforeValue} para ${afterValue}.`;
		case "responsibleId":
			return `Responsável alterado de ${beforeValue} para ${afterValue}.`;
		default:
			return buildFallbackSentence(
				SALE_FIELD_LABEL[field] ?? toFriendlyFieldName(field),
				beforeValue,
				afterValue,
			);
	}
}

function formatCommissionChange(
	change: SaleHistoryChange,
	commissionIndex: number,
	field: string,
) {
	const beforeValue = formatChangeValue(change.before, {
		type: "commission",
		commissionIndex,
		field,
	});
	const afterValue = formatChangeValue(change.after, {
		type: "commission",
		commissionIndex,
		field,
	});
	const commissionLabel = `Comissão ${commissionIndex + 1}`;

	switch (field) {
		case "sourceType":
			return `${commissionLabel}: origem alterada de ${beforeValue} para ${afterValue}.`;
		case "recipientType":
			return `${commissionLabel}: beneficiário alterado de ${beforeValue} para ${afterValue}.`;
		case "direction":
			return `${commissionLabel}: direção alterada de ${beforeValue} para ${afterValue}.`;
		case "calculationBase":
			return `${commissionLabel}: base de cálculo alterada de ${beforeValue} para ${afterValue}.`;
		case "baseCommissionIndex":
			return `${commissionLabel}: comissão base alterada de ${beforeValue} para ${afterValue}.`;
		case "beneficiaryCompanyId":
		case "beneficiaryUnitId":
		case "beneficiarySellerId":
		case "beneficiaryPartnerId":
		case "beneficiarySupervisorId":
		case "beneficiaryLabel":
			return `${commissionLabel}: beneficiário alterado de ${beforeValue} para ${afterValue}.`;
		case "startDate":
			return `${commissionLabel}: início alterado de ${beforeValue} para ${afterValue}.`;
		case "totalPercentage":
			return `${commissionLabel}: percentual total alterado de ${beforeValue} para ${afterValue}.`;
		case "sortOrder":
			return `${commissionLabel}: ordem alterada de ${beforeValue} para ${afterValue}.`;
		default:
			return buildFallbackSentence(
				`${commissionLabel.toLowerCase()} ${COMMISSION_FIELD_LABEL[field] ?? toFriendlyFieldName(field)}`,
				beforeValue,
				afterValue,
			);
	}
}

function formatInstallmentChange(
	change: SaleHistoryChange,
	commissionIndex: number,
	installmentIndex: number,
	field: string,
) {
	const beforeValue = formatChangeValue(change.before, {
		type: "installment",
		commissionIndex,
		installmentIndex,
		field,
	});
	const afterValue = formatChangeValue(change.after, {
		type: "installment",
		commissionIndex,
		installmentIndex,
		field,
	});
	const installmentLabel = `Comissão ${commissionIndex + 1}, parcela ${installmentIndex + 1}`;

	switch (field) {
		case "installmentNumber":
			return `${installmentLabel}: número alterado de ${beforeValue} para ${afterValue}.`;
		case "percentage":
			return `${installmentLabel}: percentual alterado de ${beforeValue} para ${afterValue}.`;
		case "amount":
			return `${installmentLabel}: valor alterado de ${beforeValue} para ${afterValue}.`;
		case "status":
			return `${installmentLabel}: status alterado de ${beforeValue} para ${afterValue}.`;
		case "expectedPaymentDate":
			return `${installmentLabel}: data prevista alterada de ${beforeValue} para ${afterValue}.`;
		case "paymentDate":
			return `${installmentLabel}: data de pagamento alterada de ${beforeValue} para ${afterValue}.`;
		default:
			return buildFallbackSentence(
				`${installmentLabel.toLowerCase()} ${INSTALLMENT_FIELD_LABEL[field] ?? toFriendlyFieldName(field)}`,
				beforeValue,
				afterValue,
			);
	}
}

export function formatSaleHistoryChange(change: SaleHistoryChange) {
	const parsedPath = parseHistoryPath(change.path);

	if (parsedPath.type === "dynamicField") {
		return formatDynamicFieldChange(change, parsedPath.fieldId);
	}

	if (parsedPath.type === "sale") {
		return formatSaleChange(change, parsedPath.field);
	}

	if (parsedPath.type === "commission") {
		return formatCommissionChange(
			change,
			parsedPath.commissionIndex,
			parsedPath.field,
		);
	}

	if (parsedPath.type === "installment") {
		return formatInstallmentChange(
			change,
			parsedPath.commissionIndex,
			parsedPath.installmentIndex,
			parsedPath.field,
		);
	}

	const beforeValue = formatChangeValue(change.before, parsedPath);
	const afterValue = formatChangeValue(change.after, parsedPath);
	const fallbackFieldName = toFriendlyFieldName(parsedPath.rawPath);

	return buildFallbackSentence(fallbackFieldName, beforeValue, afterValue);
}

export function toSaleHistoryTimelineEvent(
	event: SaleHistoryEvent,
): SaleHistoryTimelineEvent {
	if (event.action === "CREATED") {
		return {
			id: event.id,
			action: event.action,
			title: SALE_HISTORY_ACTION_LABEL[event.action],
			createdAt: event.createdAt,
			actor: event.actor,
			messages: ["Venda criada."],
		};
	}

	const messages = event.changes.map((change) => formatSaleHistoryChange(change));

	return {
		id: event.id,
		action: event.action,
		title: SALE_HISTORY_ACTION_LABEL[event.action],
		createdAt: event.createdAt,
		actor: event.actor,
		messages:
			messages.length > 0 ? messages : ["Alteração registrada sem diffs detalhados."],
	};
}
