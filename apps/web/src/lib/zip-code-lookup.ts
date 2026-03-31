export interface ZipCodeLookupResult {
	zipCode: string;
	street: string;
	neighborhood: string;
	city: string;
	state: string;
	country: string;
	complement: string;
}

interface LookupZipCodeOptions {
	signal?: AbortSignal;
}

interface ViaCepResponse {
	cep?: string;
	logradouro?: string;
	complemento?: string;
	bairro?: string;
	localidade?: string;
	uf?: string;
	erro?: boolean;
}

function formatZipCode(value: string) {
	const digits = value.replace(/\D/g, "").slice(0, 8);

	if (digits.length <= 5) return digits;

	return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function isViaCepResponse(value: unknown): value is ViaCepResponse {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const data = value as Record<string, unknown>;
	const isStringOrUndefined = (field: unknown) =>
		typeof field === "string" || typeof field === "undefined";
	const isBooleanOrUndefined = (field: unknown) =>
		typeof field === "boolean" || typeof field === "undefined";

	return (
		isStringOrUndefined(data.cep) &&
		isStringOrUndefined(data.logradouro) &&
		isStringOrUndefined(data.complemento) &&
		isStringOrUndefined(data.bairro) &&
		isStringOrUndefined(data.localidade) &&
		isStringOrUndefined(data.uf) &&
		isBooleanOrUndefined(data.erro)
	);
}

export async function lookupZipCode(
	zipCode: string,
	options?: LookupZipCodeOptions,
): Promise<ZipCodeLookupResult | null> {
	const digits = zipCode.replace(/\D/g, "").slice(0, 8);
	if (digits.length !== 8) {
		return null;
	}

	try {
		const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
			signal: options?.signal,
		});
		if (!response.ok) {
			return null;
		}

		const payload: unknown = await response.json();
		if (!isViaCepResponse(payload)) {
			return null;
		}
		if (payload.erro) {
			return null;
		}

		return {
			zipCode: formatZipCode(digits),
			street: payload.logradouro ?? "",
			neighborhood: payload.bairro ?? "",
			city: payload.localidade ?? "",
			state: payload.uf ?? "",
			country: "BR",
			complement: payload.complemento ?? "",
		};
	} catch {
		return null;
	}
}
