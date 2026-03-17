import { SaleDynamicFieldType } from "generated/prisma/enums";
import type { SaleDynamicFieldSchemaItem } from "./sale-dynamic-fields";
import {
	MAX_IMPORT_CELL_TEXT_LENGTH,
	MAX_IMPORT_COLUMNS,
	type SaleImportDynamicProductMapping,
} from "./sale-import-schemas";
import { BadRequestError } from "../_errors/bad-request-error";

const CONTROL_CHARACTERS_REGEX =
	/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const MULTI_VALUE_SEPARATOR_REGEX = /[;,|\n]+/;
const PRODUCT_SEARCH_TOKEN_REGEX = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu;

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATE_BR_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FlatProduct = {
	id: string;
	name: string;
	parentId: string | null;
	isActive: boolean;
};

type ProductResolverFailureCode =
	| "PRODUCT_REQUIRED"
	| "PRODUCT_NOT_FOUND"
	| "PRODUCT_NOT_FOUND_OR_INACTIVE"
	| "PRODUCT_PATH_NOT_FOUND"
	| "PRODUCT_AMBIGUOUS";

type ProductResolver = {
	resolve: (rawValue: unknown) =>
		| { ok: true; productId: string }
		| {
				ok: false;
				code: ProductResolverFailureCode;
				message: string;
			  };
};

type BuildProductResolverOptions = {
	parentProductId?: string;
};

function normalizeKey(value: string) {
	return value.trim().replace(/\s+/g, " ").normalize("NFKC").toLowerCase();
}

function normalizeProductSearchKey(value: string) {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.normalize("NFKC")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}

function tokenizeProductSearchValue(value: string) {
	const normalized = normalizeProductSearchKey(value);
	if (!normalized) {
		return [];
	}

	const tokenMatches = normalized.match(PRODUCT_SEARCH_TOKEN_REGEX) ?? [];
	const tokens = new Set<string>();

	for (const matchedToken of tokenMatches) {
		const token = matchedToken.trim();
		if (!token) {
			continue;
		}

		tokens.add(token);
		if (!token.includes("-")) {
			continue;
		}

		const parts = token
			.split("-")
			.map((part) => part.trim())
			.filter((part) => part.length > 0);
		for (const part of parts) {
			tokens.add(part);
		}
	}

	return Array.from(tokens);
}

function computeProductMatchScore(params: {
	rawValueNormalized: string;
	rawTokens: string[];
	productTextNormalized: string;
	productTokens: Set<string>;
}) {
	if (!params.rawValueNormalized) {
		return {
			score: 0,
			exactTokenMatches: 0,
		};
	}

	let score = 0;
	if (params.productTextNormalized === params.rawValueNormalized) {
		score += 120;
	}

	if (params.productTextNormalized.includes(params.rawValueNormalized)) {
		score += 60;
	}

	const productTokens = Array.from(params.productTokens);
	let matchedTokens = 0;
	let exactTokenMatches = 0;

	for (const token of params.rawTokens) {
		if (params.productTokens.has(token)) {
			score += 20;
			matchedTokens += 1;
			exactTokenMatches += 1;
			continue;
		}

		const hasPartialToken =
			token.length >= 3 &&
			productTokens.some(
				(productToken) =>
					productToken.length >= 3 &&
					(productToken.includes(token) || token.includes(productToken)),
			);

		if (hasPartialToken) {
			score += 12;
			matchedTokens += 1;
		}
	}

	if (params.rawTokens.length > 0) {
		score += Math.round((matchedTokens / params.rawTokens.length) * 20);
	}

	return {
		score,
		exactTokenMatches,
	};
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function excelSerialToDate(value: number) {
	if (!Number.isFinite(value)) {
		return null;
	}

	const integerPart = Math.trunc(value);
	const fractionalPart = value - integerPart;
	const baseDate = Date.UTC(1899, 11, 30);
	const dateMs = baseDate + integerPart * 86_400_000;
	const timeMs = Math.round(fractionalPart * 86_400_000);
	const parsed = new Date(dateMs + timeMs);

	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed;
}

export function sanitizeTextValue(
	rawValue: unknown,
	options?: { maxLength?: number; keepEmpty?: boolean; truncate?: boolean },
): string | null {
	if (rawValue === null || rawValue === undefined) {
		return null;
	}

	let value: string;
	if (typeof rawValue === "string") {
		value = rawValue;
	} else if (typeof rawValue === "number" || typeof rawValue === "boolean") {
		value = String(rawValue);
	} else {
		return null;
	}

	const sanitized = value
		.replace(CONTROL_CHARACTERS_REGEX, "")
		.replace(/\uFEFF/g, "")
		.trim();

	if (!sanitized && !options?.keepEmpty) {
		return null;
	}

	const maxLength = options?.maxLength ?? MAX_IMPORT_CELL_TEXT_LENGTH;
	if (sanitized.length > maxLength) {
		if (options?.truncate === false) {
			return sanitized;
		}
		return sanitized.slice(0, maxLength);
	}

	return sanitized;
}

export function assertImportRowsSecurity(rows: Array<Record<string, unknown>>) {
	for (const [rowIndex, row] of rows.entries()) {
		if (!isPlainObject(row)) {
			throw new BadRequestError(
				`Invalid import row payload at line ${rowIndex + 1}`,
			);
		}

		const keys = Object.keys(row);
		if (keys.length > MAX_IMPORT_COLUMNS) {
			throw new BadRequestError(
				`Import row ${rowIndex + 1} exceeds max allowed columns (${MAX_IMPORT_COLUMNS})`,
			);
		}

		for (const key of keys) {
			const cellValue = row[key];
			if (
				typeof cellValue === "object" &&
				cellValue !== null &&
				!(cellValue instanceof Date)
			) {
				throw new BadRequestError(
					`Invalid structured value in row ${rowIndex + 1}, column "${key}"`,
				);
			}

			if (typeof cellValue === "string") {
				const sanitized = sanitizeTextValue(cellValue, {
					maxLength: MAX_IMPORT_CELL_TEXT_LENGTH,
					keepEmpty: true,
					truncate: false,
				});
				if (
					sanitized !== null &&
					sanitized.length > MAX_IMPORT_CELL_TEXT_LENGTH
				) {
					throw new BadRequestError(
						`Cell value too long in row ${rowIndex + 1}, column "${key}"`,
					);
				}
			}
		}
	}
}

export function normalizeDocumentDigits(rawValue: unknown) {
	const value = sanitizeTextValue(rawValue, { maxLength: 64 });
	if (!value) {
		return null;
	}

	const digitsOnly = value.replace(/\D/g, "");
	return digitsOnly.length > 0 ? digitsOnly : null;
}

export function isValidCpf(value: string) {
	if (value.length !== 11 || /(\d)\1{10}/.test(value)) {
		return false;
	}

	const digits = value.split("").map(Number);

	const calcVerifier = (sliceLength: number) => {
		let sum = 0;
		for (let index = 0; index < sliceLength; index += 1) {
			sum += digits[index] * (sliceLength + 1 - index);
		}
		const remainder = (sum * 10) % 11;
		return remainder === 10 ? 0 : remainder;
	};

	return calcVerifier(9) === digits[9] && calcVerifier(10) === digits[10];
}

export function isValidCnpj(value: string) {
	if (value.length !== 14 || /(\d)\1{13}/.test(value)) {
		return false;
	}

	const digits = value.split("").map(Number);

	const calcVerifier = (weights: number[]) => {
		const sum = weights.reduce((acc, weight, index) => {
			return acc + digits[index] * weight;
		}, 0);
		const remainder = sum % 11;
		return remainder < 2 ? 0 : 11 - remainder;
	};

	const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
	const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

	return (
		calcVerifier(firstWeights) === digits[12] &&
		calcVerifier(secondWeights) === digits[13]
	);
}

export function normalizePhoneDigits(rawValue: unknown) {
	const value = sanitizeTextValue(rawValue, { maxLength: 40 });
	if (!value) {
		return null;
	}

	const digits = value.replace(/\D/g, "");
	if (digits.length < 8 || digits.length > 15) {
		return null;
	}

	return digits;
}

export function normalizeEmail(rawValue: unknown) {
	const value = sanitizeTextValue(rawValue, { maxLength: 320 });
	if (!value) {
		return null;
	}

	const normalized = value.toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
		return null;
	}

	return normalized;
}

export function parseImportAmountToCents(rawValue: unknown) {
	if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
		if (rawValue <= 0) {
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
		if (!Number.isFinite(parsedInteger) || parsedInteger <= 0) {
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
	if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
		return null;
	}

	return Math.round((parsedNumber + Number.EPSILON) * 100);
}

function formatDateOnly(date: Date) {
	return date.toISOString().slice(0, 10);
}

export function parseImportSaleDate(rawValue: unknown) {
	if (typeof rawValue === "number") {
		const parsedDate = excelSerialToDate(rawValue);
		if (!parsedDate) {
			return null;
		}

		return formatDateOnly(parsedDate);
	}

	if (rawValue instanceof Date) {
		if (Number.isNaN(rawValue.getTime())) {
			return null;
		}
		return formatDateOnly(rawValue);
	}

	const value = sanitizeTextValue(rawValue, { maxLength: 40 });
	if (!value) {
		return null;
	}

	if (DATE_ONLY_REGEX.test(value)) {
		const parsedDate = new Date(`${value}T00:00:00.000Z`);
		if (
			!Number.isNaN(parsedDate.getTime()) &&
			formatDateOnly(parsedDate) === value
		) {
			return value;
		}
	}

	const brMatch = value.match(DATE_BR_REGEX);
	if (brMatch) {
		const [, day, month, year] = brMatch;
		const normalized = `${year}-${month}-${day}`;
		const parsedDate = new Date(`${normalized}T00:00:00.000Z`);
		if (
			!Number.isNaN(parsedDate.getTime()) &&
			formatDateOnly(parsedDate) === normalized
		) {
			return normalized;
		}
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return formatDateOnly(parsed);
}

export function parseImportDateTime(rawValue: unknown) {
	if (typeof rawValue === "number") {
		const parsedDate = excelSerialToDate(rawValue);
		return parsedDate ? parsedDate.toISOString() : null;
	}

	if (rawValue instanceof Date) {
		if (Number.isNaN(rawValue.getTime())) {
			return null;
		}
		return rawValue.toISOString();
	}

	const value = sanitizeTextValue(rawValue, { maxLength: 80 });
	if (!value) {
		return null;
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	return parsed.toISOString();
}

function resolveProductPathById(products: FlatProduct[]) {
	const productsById = new Map(
		products.map((product) => [product.id, product]),
	);
	const pathMemo = new Map<string, string>();

	function getPath(productId: string, visited = new Set<string>()): string {
		const existingPath = pathMemo.get(productId);
		if (existingPath) {
			return existingPath;
		}

		const product = productsById.get(productId);
		if (!product) {
			return "";
		}

		if (visited.has(productId)) {
			return product.name;
		}

		visited.add(productId);
		if (!product.parentId) {
			pathMemo.set(productId, product.name);
			return product.name;
		}

		const parentPath = getPath(product.parentId, visited);
		const path = parentPath ? `${parentPath} -> ${product.name}` : product.name;
		pathMemo.set(productId, path);
		return path;
	}

	for (const product of products) {
		getPath(product.id);
	}

	return pathMemo;
}

export function buildProductResolver(
	products: FlatProduct[],
	options?: BuildProductResolverOptions,
): ProductResolver {
	const activeProducts = products.filter((product) => product.isActive);
	const productsById = new Map(
		activeProducts.map((product) => [product.id, product]),
	);
	const scopedParentProductId =
		options?.parentProductId && productsById.has(options.parentProductId)
			? options.parentProductId
			: null;
	const productPathById = resolveProductPathById(activeProducts);
	const productByNormalizedPath = new Map<string, string>();
	const productIdsByNormalizedName = new Map<string, string[]>();
	const productSearchIndexes = activeProducts.map((product) => {
		const path = productPathById.get(product.id);
		const label = path ?? product.name;
		const normalizedSearchText = normalizeProductSearchKey(
			`${product.name} ${path ?? ""}`,
		);
		const productSearchTokens = new Set(
			tokenizeProductSearchValue(`${product.name} ${path ?? ""}`),
		);

		return {
			productId: product.id,
			label,
			normalizedSearchText,
			productSearchTokens,
		};
	});
	const productSearchIndexById = new Map(
		productSearchIndexes.map((index) => [index.productId, index]),
	);
	const childrenByParentId = new Map<string, string[]>();
	const descendantIdsMemo = new Map<string, string[]>();
	const parentScopeIdsMemo = new Map<string, Set<string>>();

	for (const product of activeProducts) {
		if (!product.parentId) {
			continue;
		}

		const currentChildren = childrenByParentId.get(product.parentId) ?? [];
		currentChildren.push(product.id);
		childrenByParentId.set(product.parentId, currentChildren);
	}

	function getDescendantIds(productId: string): string[] {
		const memoized = descendantIdsMemo.get(productId);
		if (memoized) {
			return memoized;
		}

		const descendants: string[] = [];
		const stack = [...(childrenByParentId.get(productId) ?? [])];

		while (stack.length > 0) {
			const currentId = stack.pop();
			if (!currentId) {
				continue;
			}

			descendants.push(currentId);
			const children = childrenByParentId.get(currentId);
			if (children) {
				stack.push(...children);
			}
		}

		descendantIdsMemo.set(productId, descendants);
		return descendants;
	}

	function getParentScopeProductIds(parentProductId: string) {
		const memoized = parentScopeIdsMemo.get(parentProductId);
		if (memoized) {
			return memoized;
		}

		const scopeIds = new Set<string>([
			parentProductId,
			...getDescendantIds(parentProductId),
		]);
		parentScopeIdsMemo.set(parentProductId, scopeIds);
		return scopeIds;
	}

	function resolveMostLikelyChildFromParent(params: {
		parentProductId: string;
		rawValueNormalized: string;
		rawTokens: string[];
	}): string | null {
		const parentIndex = productSearchIndexById.get(params.parentProductId);
		if (!parentIndex) {
			return null;
		}

		const descendantIds = getDescendantIds(params.parentProductId);
		if (descendantIds.length === 0) {
			return null;
		}

		const candidates = descendantIds
			.map((descendantId) => productSearchIndexById.get(descendantId))
			.filter((index): index is NonNullable<typeof index> => Boolean(index))
			.map((index) => {
				const match = computeProductMatchScore({
					rawValueNormalized: params.rawValueNormalized,
					rawTokens: params.rawTokens,
					productTextNormalized: index.normalizedSearchText,
					productTokens: index.productSearchTokens,
				});

				const childSpecificExactTokenMatches = params.rawTokens.reduce(
					(total, token) => {
						if (
							index.productSearchTokens.has(token) &&
							!parentIndex.productSearchTokens.has(token)
						) {
							return total + 1;
						}

						return total;
					},
					0,
				);

				return {
					index,
					match,
					childSpecificExactTokenMatches,
				};
			})
			.filter(
				(candidate) =>
					candidate.match.score > 0 &&
					candidate.match.exactTokenMatches > 0 &&
					candidate.childSpecificExactTokenMatches > 0,
			)
			.sort((candidateA, candidateB) => {
				if (
					candidateA.childSpecificExactTokenMatches !==
					candidateB.childSpecificExactTokenMatches
				) {
					return (
						candidateB.childSpecificExactTokenMatches -
						candidateA.childSpecificExactTokenMatches
					);
				}

				if (candidateA.match.score !== candidateB.match.score) {
					return candidateB.match.score - candidateA.match.score;
				}

				const labelComparison = candidateA.index.label.localeCompare(
					candidateB.index.label,
				);
				if (labelComparison !== 0) {
					return labelComparison;
				}

				return candidateA.index.productId.localeCompare(
					candidateB.index.productId,
				);
			});

		return candidates[0]?.index.productId ?? null;
	}

	function resolveWithBestChildFallback(
		baseProductId: string,
		rawValue: string,
	) {
		const rawValueNormalized = normalizeProductSearchKey(rawValue);
		const rawTokens = tokenizeProductSearchValue(rawValue);
		const childProductId = resolveMostLikelyChildFromParent({
			parentProductId: baseProductId,
			rawValueNormalized,
			rawTokens,
		});

		return childProductId ?? baseProductId;
	}

	function resolveWithinParentScope(rawValue: string) {
		if (!scopedParentProductId) {
			return null;
		}

		const scopeProductIds = getParentScopeProductIds(scopedParentProductId);
		const normalized = normalizeProductSearchKey(rawValue);

		const isProductInScope = (productId: string) => {
			return scopeProductIds.has(productId);
		};

		if (UUID_REGEX.test(rawValue)) {
			if (isProductInScope(rawValue)) {
				return resolveWithBestChildFallback(rawValue, rawValue);
			}
		}

		if (rawValue.includes("->")) {
			const byPath = productByNormalizedPath.get(normalized);
			if (byPath && isProductInScope(byPath)) {
				return resolveWithBestChildFallback(byPath, rawValue);
			}
		}

		const idsByName = productIdsByNormalizedName.get(normalized) ?? [];
		const scopedIdsByName = idsByName.filter((productId) =>
			isProductInScope(productId),
		);
		if (scopedIdsByName.length === 1) {
			return resolveWithBestChildFallback(scopedIdsByName[0], rawValue);
		}

		const rawValueNormalized = normalizeProductSearchKey(rawValue);
		const rawTokens = tokenizeProductSearchValue(rawValue);
		const childProductId = resolveMostLikelyChildFromParent({
			parentProductId: scopedParentProductId,
			rawValueNormalized,
			rawTokens,
		});

		return childProductId ?? scopedParentProductId;
	}

	for (const product of activeProducts) {
		const normalizedName = normalizeProductSearchKey(product.name);
		const currentNameIds = productIdsByNormalizedName.get(normalizedName) ?? [];
		currentNameIds.push(product.id);
		productIdsByNormalizedName.set(normalizedName, currentNameIds);

		const path = productPathById.get(product.id);
		if (path) {
			productByNormalizedPath.set(normalizeProductSearchKey(path), product.id);
		}
	}

		return {
			resolve: (rawValue) => {
				const value = sanitizeTextValue(rawValue, { maxLength: 500 });
				if (!value) {
					if (scopedParentProductId) {
						return {
							ok: true,
							productId: scopedParentProductId,
						};
					}

					return {
						ok: false,
						code: "PRODUCT_REQUIRED",
						message: "Product is required",
					};
				}

				const scopedProductId = resolveWithinParentScope(value);
				if (scopedProductId) {
					return {
						ok: true,
						productId: scopedProductId,
					};
				}

				if (UUID_REGEX.test(value)) {
				if (productsById.has(value)) {
					return {
						ok: true,
						productId: resolveWithBestChildFallback(value, value),
					};
				}
				return {
					ok: false,
					code: "PRODUCT_NOT_FOUND_OR_INACTIVE",
					message: "Product not found or inactive for organization",
				};
			}

			const normalized = normalizeProductSearchKey(value);
			if (value.includes("->")) {
				const byPath = productByNormalizedPath.get(normalized);
				if (!byPath) {
					return {
						ok: false,
						code: "PRODUCT_PATH_NOT_FOUND",
						message: "Product path not found",
					};
				}
				return {
					ok: true,
					productId: resolveWithBestChildFallback(byPath, value),
				};
			}

			const idsByName = productIdsByNormalizedName.get(normalized) ?? [];
			if (idsByName.length === 1) {
				return {
					ok: true,
					productId: resolveWithBestChildFallback(idsByName[0], value),
				};
			}

			if (idsByName.length > 1) {
				return {
					ok: false,
					code: "PRODUCT_AMBIGUOUS",
					message:
						"Product name is ambiguous. Use product UUID or full path (Parent -> Child)",
				};
			}

			const searchTokens = tokenizeProductSearchValue(value);
			if (searchTokens.length > 0) {
				const rankedCandidates = productSearchIndexes
					.map((index) => ({
						index,
						match: computeProductMatchScore({
							rawValueNormalized: normalized,
							rawTokens: searchTokens,
							productTextNormalized: index.normalizedSearchText,
							productTokens: index.productSearchTokens,
						}),
					}))
					.filter(
						(candidate) =>
							candidate.match.score > 0 &&
							candidate.match.exactTokenMatches > 0,
					)
					.sort((candidateA, candidateB) => {
						if (candidateA.match.score !== candidateB.match.score) {
							return candidateB.match.score - candidateA.match.score;
						}

						const labelComparison = candidateA.index.label.localeCompare(
							candidateB.index.label,
						);
						if (labelComparison !== 0) {
							return labelComparison;
						}

						return candidateA.index.productId.localeCompare(
							candidateB.index.productId,
						);
					});

				if (rankedCandidates.length > 0) {
					const bestProductId = rankedCandidates[0].index.productId;
					return {
						ok: true,
						productId: resolveWithBestChildFallback(bestProductId, value),
					};
				}
			}

			return {
				ok: false,
				code: "PRODUCT_NOT_FOUND",
				message: "Product not found",
			};
		},
	};
}

function resolveSelectOptionId(
	field: SaleDynamicFieldSchemaItem,
	rawValue: unknown,
): string | null {
	const value = sanitizeTextValue(rawValue, { maxLength: 320 });
	if (!value) {
		return null;
	}

	const optionById = field.options.find((option) => option.id === value);
	if (optionById) {
		return optionById.id;
	}

	const normalizedValue = normalizeKey(value);
	const optionByLabel = field.options.find(
		(option) => normalizeKey(option.label) === normalizedValue,
	);

	return optionByLabel?.id ?? null;
}

function resolveMultiSelectOptionIds(
	field: SaleDynamicFieldSchemaItem,
	rawValue: unknown,
): string[] {
	if (Array.isArray(rawValue)) {
		const resolved = rawValue
			.map((item) => resolveSelectOptionId(field, item))
			.filter((value): value is string => Boolean(value));
		return Array.from(new Set(resolved));
	}

	const value = sanitizeTextValue(rawValue, {
		maxLength: MAX_IMPORT_CELL_TEXT_LENGTH,
	});
	if (!value) {
		return [];
	}

	const parts = value
		.split(MULTI_VALUE_SEPARATOR_REGEX)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

	const resolved = parts
		.map((part) => resolveSelectOptionId(field, part))
		.filter((part): part is string => Boolean(part));

	return Array.from(new Set(resolved));
}

export function mapDynamicImportRawValue(
	field: SaleDynamicFieldSchemaItem,
	rawValue: unknown,
) {
	if (field.type === SaleDynamicFieldType.SELECT) {
		return resolveSelectOptionId(field, rawValue);
	}

	if (field.type === SaleDynamicFieldType.MULTI_SELECT) {
		return resolveMultiSelectOptionIds(field, rawValue);
	}

	if (field.type === SaleDynamicFieldType.DATE) {
		return parseImportSaleDate(rawValue);
	}

	if (field.type === SaleDynamicFieldType.DATE_TIME) {
		return parseImportDateTime(rawValue);
	}

	if (
		field.type === SaleDynamicFieldType.TEXT ||
		field.type === SaleDynamicFieldType.PHONE ||
		field.type === SaleDynamicFieldType.RICH_TEXT
	) {
		return sanitizeTextValue(rawValue, {
			maxLength:
				field.type === SaleDynamicFieldType.RICH_TEXT
					? MAX_IMPORT_CELL_TEXT_LENGTH
					: 1_000,
		});
	}

	return rawValue;
}

export function mapDynamicColumnsByFieldId(
	mapping: SaleImportDynamicProductMapping[],
): Map<string, Map<string, string>> {
	const mapByProduct = new Map<string, Map<string, string>>();

	for (const productMapping of mapping) {
		const byFieldId = new Map<string, string>();
		for (const fieldMapping of productMapping.fields) {
			byFieldId.set(fieldMapping.fieldId, fieldMapping.columnKey);
		}
		mapByProduct.set(productMapping.productId, byFieldId);
	}

	return mapByProduct;
}
