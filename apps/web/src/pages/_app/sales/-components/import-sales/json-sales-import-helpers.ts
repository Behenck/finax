export type ParsedJsonSalesImportPayload = {
	fileName: string;
	cotas: Array<Record<string, unknown>>;
	jsonKeys: string[];
};

type DynamicSaleField = {
	id: string;
	label: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeJsonImportSearchValue(value: string) {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.normalize("NFKC")
		.toLowerCase()
		.trim()
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ");
}

export function collectJsonSalesImportKeys(cotas: Array<Record<string, unknown>>) {
	const ignoredKeys = new Set(["cliente", "vendedor", "comissoes"]);
	const keys = new Set<string>();

	for (const cota of cotas.slice(0, 50)) {
		for (const [key, value] of Object.entries(cota)) {
			if (ignoredKeys.has(key) || isRecord(value) || Array.isArray(value)) {
				continue;
			}
			keys.add(key);
		}
	}

	return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

export function parseJsonSalesImportContent(
	fileName: string,
	content: string,
): ParsedJsonSalesImportPayload {
	const parsed = JSON.parse(content) as unknown;
	if (!isRecord(parsed) || !Array.isArray(parsed.cotas)) {
		throw new Error("JSON inválido: raiz deve conter cotas.");
	}

	const cotas = parsed.cotas.filter(isRecord);
	if (cotas.length === 0) {
		throw new Error("JSON sem cotas válidas.");
	}

	return {
		fileName,
		cotas,
		jsonKeys: collectJsonSalesImportKeys(cotas),
	};
}

export function buildSuggestedJsonDynamicFieldMappings(params: {
	fields: DynamicSaleField[];
	jsonKeys: string[];
	currentMappings?: Record<string, string>;
}) {
	const next = { ...(params.currentMappings ?? {}) };

	for (const field of params.fields) {
		if (next[field.id]) {
			continue;
		}

		const fieldKey = normalizeJsonImportSearchValue(field.label);
		const matchedKey = params.jsonKeys.find(
			(key) => normalizeJsonImportSearchValue(key) === fieldKey,
		);
		if (matchedKey) {
			next[field.id] = matchedKey;
		}
	}

	return next;
}
