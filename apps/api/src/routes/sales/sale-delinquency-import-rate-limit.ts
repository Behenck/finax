type RateLimitConfig = {
	limit: number;
	windowMs: number;
};

class SaleDelinquencyImportRateLimitError extends Error {
	statusCode = 429;

	constructor() {
		super("Rate limit exceeded for sale delinquency import.");
	}
}

const requestsByKey = new Map<string, number[]>();

function cleanupExpired(now: number, windowMs: number, timestamps: number[]) {
	const threshold = now - windowMs;
	let index = 0;

	while (index < timestamps.length && timestamps[index] <= threshold) {
		index += 1;
	}

	if (index > 0) {
		timestamps.splice(0, index);
	}
}

export function assertSaleDelinquencyImportRateLimit(
	key: string,
	config: RateLimitConfig,
) {
	const now = Date.now();
	const timestamps = requestsByKey.get(key) ?? [];

	cleanupExpired(now, config.windowMs, timestamps);

	if (timestamps.length >= config.limit) {
		throw new SaleDelinquencyImportRateLimitError();
	}

	timestamps.push(now);
	requestsByKey.set(key, timestamps);
}

export const saleDelinquencyImportRateLimit = {
	templates: {
		limit: 120,
		windowMs: 60_000,
	},
	imports: {
		limit: 20,
		windowMs: 60_000,
	},
} as const;
