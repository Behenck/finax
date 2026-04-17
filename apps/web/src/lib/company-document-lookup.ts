export interface CompanyDocumentLookupResult {
	name: string;
	companyName: string;
	email: string;
	phone: string;
	zipCode: string;
	state: string;
	city: string;
	street: string;
	neighborhood: string;
	number: string;
	complement: string;
}

interface LookupCompanyDocumentOptions {
	signal?: AbortSignal;
}

interface BrasilApiCnpjQsaItem {
	nome_socio?: string | null;
}

interface BrasilApiCnpjResponse {
	qsa?: BrasilApiCnpjQsaItem[];
	email?: string | null;
	cep?: string | null;
	uf?: string | null;
	municipio?: string | null;
	logradouro?: string | null;
	bairro?: string | null;
	numero?: string | null;
	complemento?: string | null;
	razao_social?: string | null;
	nome_fantasia?: string | null;
	ddd_telefone_1?: string | null;
}

function onlyDigits(value: string) {
	return value.replace(/\D/g, "");
}

function formatZipCode(value?: string | null) {
	const digits = onlyDigits(value ?? "").slice(0, 8);

	if (digits.length <= 5) return digits;

	return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function isStringNullOrUndefined(value: unknown) {
	return (
		typeof value === "string" || value === null || typeof value === "undefined"
	);
}

function isBrasilApiCnpjResponse(
	value: unknown,
): value is BrasilApiCnpjResponse {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const data = value as Record<string, unknown>;
	const qsaIsValid =
		typeof data.qsa === "undefined" ||
		(Array.isArray(data.qsa) &&
			data.qsa.every(
				(item) =>
					item &&
					typeof item === "object" &&
					!Array.isArray(item) &&
					isStringNullOrUndefined((item as Record<string, unknown>).nome_socio),
			));

	return (
		qsaIsValid &&
		isStringNullOrUndefined(data.email) &&
		isStringNullOrUndefined(data.cep) &&
		isStringNullOrUndefined(data.uf) &&
		isStringNullOrUndefined(data.municipio) &&
		isStringNullOrUndefined(data.logradouro) &&
		isStringNullOrUndefined(data.bairro) &&
		isStringNullOrUndefined(data.numero) &&
		isStringNullOrUndefined(data.complemento) &&
		isStringNullOrUndefined(data.razao_social) &&
		isStringNullOrUndefined(data.nome_fantasia) &&
		isStringNullOrUndefined(data.ddd_telefone_1)
	);
}

export async function lookupCompanyDocument(
	document: string,
	options?: LookupCompanyDocumentOptions,
): Promise<CompanyDocumentLookupResult | null> {
	const digits = onlyDigits(document).slice(0, 14);

	if (digits.length !== 14) {
		return null;
	}

	try {
		const response = await fetch(
			`https://brasilapi.com.br/api/cnpj/v1/${digits}`,
			{ signal: options?.signal },
		);

		if (!response.ok) {
			return null;
		}

		const payload: unknown = await response.json();
		if (!isBrasilApiCnpjResponse(payload)) {
			return null;
		}

		return {
			name: payload.qsa?.[0]?.nome_socio ?? "",
			companyName: payload.nome_fantasia || payload.razao_social || "",
			email: payload.email ?? "",
			phone: payload.ddd_telefone_1 ?? "",
			zipCode: formatZipCode(payload.cep),
			state: payload.uf ?? "",
			city: payload.municipio ?? "",
			street: payload.logradouro ?? "",
			neighborhood: payload.bairro ?? "",
			number: payload.numero ?? "",
			complement: payload.complemento ?? "",
		};
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			throw error;
		}

		return null;
	}
}
