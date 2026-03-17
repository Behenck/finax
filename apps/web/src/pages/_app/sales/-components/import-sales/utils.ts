import * as XLSX from "xlsx";
import type { ImportFileType } from "@/schemas/types/sale-import";

export const MAX_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5_000;
export const MAX_IMPORT_COLUMNS = 200;
export const MAX_IMPORT_CELL_TEXT_LENGTH = 5_000;

const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls", "csv"]);
const BLOCKED_EXTENSIONS = new Set(["xlsm", "xlsb", "ods"]);
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export type ParsedImportFile = {
	fileType: ImportFileType;
	extension: "xlsx" | "xls" | "csv";
	name: string;
	size: number;
	headers: string[];
	headerSignature: string;
	rows: Array<Record<string, unknown>>;
};

function resolveFileExtension(fileName: string) {
	const parts = fileName.toLowerCase().split(".");
	return parts.length > 1 ? parts[parts.length - 1] : "";
}

function stripInvalidControlCharacters(value: string) {
	let result = "";

	for (const char of value) {
		const charCode = char.charCodeAt(0);
		const isInvalidControlChar =
			charCode <= 0x08 ||
			charCode === 0x0b ||
			charCode === 0x0c ||
			(charCode >= 0x0e && charCode <= 0x1f) ||
			charCode === 0x7f;

		if (!isInvalidControlChar) {
			result += char;
		}
	}

	return result;
}

function extensionToFileType(extension: "xlsx" | "xls" | "csv"): ImportFileType {
	if (extension === "xlsx") {
		return "XLSX";
	}

	if (extension === "xls") {
		return "XLS";
	}

	return "CSV";
}

function startsWithSignature(buffer: Uint8Array, signature: number[]) {
	if (buffer.length < signature.length) {
		return false;
	}

	for (let index = 0; index < signature.length; index += 1) {
		if (buffer[index] !== signature[index]) {
			return false;
		}
	}

	return true;
}

function looksLikeZip(buffer: Uint8Array) {
	if (buffer.length < 4) {
		return false;
	}

	return buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function looksLikeText(buffer: Uint8Array) {
	const sample = buffer.subarray(0, Math.min(buffer.length, 2048));
	for (const byte of sample) {
		if (byte === 0x00) {
			return false;
		}
	}

	return true;
}

function assertFileSecurity(file: File, extension: string, buffer: Uint8Array) {
	if (BLOCKED_EXTENSIONS.has(extension)) {
		throw new Error(
			`Formato .${extension} bloqueado por segurança. Use .xlsx, .xls ou .csv.`,
		);
	}

	if (!ALLOWED_EXTENSIONS.has(extension)) {
		throw new Error("Formato de arquivo não permitido. Use .xlsx, .xls ou .csv.");
	}

	if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
		throw new Error("Arquivo excede o limite de 10MB.");
	}

	if (extension === "xlsx") {
		if (!looksLikeZip(buffer)) {
			throw new Error(
				"Assinatura do arquivo inválida para .xlsx. Envie um arquivo compatível.",
			);
		}
		return;
	}

	if (extension === "xls") {
		if (!startsWithSignature(buffer, OLE_SIGNATURE)) {
			throw new Error(
				"Assinatura do arquivo inválida para .xls. Envie um arquivo compatível.",
			);
		}
		return;
	}

	if (extension === "csv") {
		if (!looksLikeText(buffer)) {
			throw new Error("Arquivo .csv inválido ou binário.");
		}
	}
}

function sanitizeHeader(rawHeader: unknown, index: number) {
	const baseLabel =
		typeof rawHeader === "string" || typeof rawHeader === "number"
			? String(rawHeader)
			: "";
	const cleaned = stripInvalidControlCharacters(baseLabel)
		.replace(/\uFEFF/g, "")
		.trim();

	if (!cleaned) {
		return `coluna_${index + 1}`;
	}

	if (cleaned.length > 120) {
		return cleaned.slice(0, 120);
	}

	return cleaned;
}

function sanitizeStringValue(rawValue: string) {
	const sanitized = stripInvalidControlCharacters(rawValue)
		.replace(/\uFEFF/g, "")
		.trim();

	if (!sanitized) {
		return "";
	}

	if (sanitized.length > MAX_IMPORT_CELL_TEXT_LENGTH) {
		return sanitized.slice(0, MAX_IMPORT_CELL_TEXT_LENGTH);
	}

	return sanitized;
}

function normalizeCellValue(rawValue: unknown) {
	if (rawValue === null || rawValue === undefined) {
		return "";
	}

	if (typeof rawValue === "number" || typeof rawValue === "boolean") {
		return rawValue;
	}

	if (rawValue instanceof Date) {
		if (Number.isNaN(rawValue.getTime())) {
			return "";
		}
		return rawValue.toISOString();
	}

	if (typeof rawValue === "string") {
		return sanitizeStringValue(rawValue);
	}

	return sanitizeStringValue(String(rawValue));
}

function hasMeaningfulValue(value: unknown) {
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value === "string") {
		return value.trim().length > 0;
	}

	return true;
}

async function createHeaderSignature(headers: string[]) {
	const payload = headers.join("||");
	const encoder = new TextEncoder();
	const bytes = encoder.encode(payload);

	if (typeof window !== "undefined" && window.crypto?.subtle) {
		const digest = await window.crypto.subtle.digest("SHA-256", bytes);
		const hashArray = Array.from(new Uint8Array(digest));
		const hashHex = hashArray
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
		return `sha256:${hashHex}`;
	}

	let hash = 0;
	for (const char of payload) {
		hash = (hash << 5) - hash + char.charCodeAt(0);
		hash |= 0;
	}

	return `hash:${Math.abs(hash)}`;
}

function normalizeRowsFromMatrix(
	matrix: unknown[][],
	headers: string[],
): Array<Record<string, unknown>> {
	const rawRows = matrix.slice(1);
	const nonEmptyRows = rawRows.filter((row) => row.some(hasMeaningfulValue));

	if (nonEmptyRows.length > MAX_IMPORT_ROWS) {
		throw new Error(
			`A planilha possui ${nonEmptyRows.length} linhas. O limite é ${MAX_IMPORT_ROWS}.`,
		);
	}

	return nonEmptyRows.map((row) => {
		const normalized: Record<string, unknown> = {};
		for (let index = 0; index < headers.length; index += 1) {
			const header = headers[index];
			normalized[header] = normalizeCellValue(row[index]);
		}
		return normalized;
	});
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedImportFile> {
	const extension = resolveFileExtension(file.name);
	if (!extension) {
		throw new Error("Não foi possível identificar a extensão do arquivo.");
	}

	const arrayBuffer = await file.arrayBuffer();
	const buffer = new Uint8Array(arrayBuffer);
	assertFileSecurity(file, extension, buffer);

	if (extension !== "xlsx" && extension !== "xls" && extension !== "csv") {
		throw new Error("Formato de arquivo não permitido.");
	}

	const workbook = XLSX.read(arrayBuffer, {
		type: "array",
		raw: true,
		cellDates: true,
		WTF: false,
	});

	const [firstSheetName] = workbook.SheetNames;
	if (!firstSheetName) {
		throw new Error("Planilha vazia ou sem aba válida.");
	}

	const firstSheet = workbook.Sheets[firstSheetName];
	if (!firstSheet) {
		throw new Error("Não foi possível ler a primeira aba da planilha.");
	}

	const matrix = XLSX.utils.sheet_to_json(firstSheet, {
		header: 1,
		raw: true,
		blankrows: false,
		defval: null,
	}) as unknown[][];

	if (matrix.length === 0) {
		throw new Error("A planilha não possui dados para importar.");
	}

	const rawHeaders = matrix[0] ?? [];
	if (!Array.isArray(rawHeaders) || rawHeaders.length === 0) {
		throw new Error("A planilha não possui cabeçalho válido na primeira linha.");
	}

	if (rawHeaders.length > MAX_IMPORT_COLUMNS) {
		throw new Error(
			`A planilha possui ${rawHeaders.length} colunas. O limite é ${MAX_IMPORT_COLUMNS}.`,
		);
	}

	const seenHeaders = new Map<string, number>();
	const headers = rawHeaders.map((rawHeader, index) => {
		const sanitized = sanitizeHeader(rawHeader, index);
		const currentCount = seenHeaders.get(sanitized) ?? 0;
		seenHeaders.set(sanitized, currentCount + 1);
		if (currentCount === 0) {
			return sanitized;
		}
		return `${sanitized}_${currentCount + 1}`;
	});

	const rows = normalizeRowsFromMatrix(matrix, headers);
	if (rows.length === 0) {
		throw new Error("A planilha não possui linhas preenchidas para importar.");
	}

	const headerSignature = await createHeaderSignature(headers);

	return {
		fileType: extensionToFileType(extension),
		extension,
		name: file.name,
		size: file.size,
		headers,
		headerSignature,
		rows,
	};
}
