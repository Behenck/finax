export const MIN_SALE_CUSTOMER_SEARCH_LENGTH = 3;

export interface SaleCustomerSearchCandidate {
	id: string;
	name: string;
	documentNumber: string;
	phone: string | null;
}

function toDigitsOnly(value: string) {
	return value.replace(/\D/g, "");
}

export function normalizeCustomerSearchValue(value: string) {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/\s+/g, " ")
		.trim();
}

export function filterCustomersForSaleSearch<T extends SaleCustomerSearchCandidate>(
	customers: T[],
	query: string,
) {
	const normalizedQuery = normalizeCustomerSearchValue(query);
	const digitsQuery = toDigitsOnly(query);

	if (normalizedQuery.length < MIN_SALE_CUSTOMER_SEARCH_LENGTH) {
		return [];
	}

	const startsWithMatches: T[] = [];
	const includesMatches: T[] = [];

	for (const customer of customers) {
		const normalizedName = normalizeCustomerSearchValue(customer.name);
		const normalizedDocument = normalizeCustomerSearchValue(customer.documentNumber);
		const normalizedPhone = normalizeCustomerSearchValue(customer.phone ?? "");
		const documentDigits = toDigitsOnly(customer.documentNumber);
		const phoneDigits = toDigitsOnly(customer.phone ?? "");

		const matchesByText =
			normalizedName.includes(normalizedQuery) ||
			normalizedDocument.includes(normalizedQuery) ||
			normalizedPhone.includes(normalizedQuery);
		const matchesByDigits =
			digitsQuery.length > 0 &&
			(documentDigits.includes(digitsQuery) || phoneDigits.includes(digitsQuery));
		const isMatch = matchesByText || matchesByDigits;

		if (!isMatch) {
			continue;
		}

		const startsWithByText =
			normalizedName.startsWith(normalizedQuery) ||
			normalizedDocument.startsWith(normalizedQuery) ||
			normalizedPhone.startsWith(normalizedQuery);
		const startsWithByDigits =
			digitsQuery.length > 0 &&
			(documentDigits.startsWith(digitsQuery) || phoneDigits.startsWith(digitsQuery));

		if (startsWithByText || startsWithByDigits) {
			startsWithMatches.push(customer);
			continue;
		}

		includesMatches.push(customer);
	}

	return [...startsWithMatches, ...includesMatches];
}
