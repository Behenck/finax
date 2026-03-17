type RateLimitConfig = {
	limit: number;
	windowMs: number;
};

class SaleImportRateLimitError extends Error {
	statusCode = 429;

	constructor() {
		super("Rate limit exceeded for sales import.");
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

export function assertRateLimit(key: string, config: RateLimitConfig) {
	const now = Date.now();
	const timestamps = requestsByKey.get(key) ?? [];

	cleanupExpired(now, config.windowMs, timestamps);

	if (timestamps.length >= config.limit) {
		throw new SaleImportRateLimitError();
	}

	timestamps.push(now);
	requestsByKey.set(key, timestamps);
}

export const saleImportRateLimit = {
	templates: {
		limit: 120,
		windowMs: 60_000,
	},
	imports: {
		limit: 20,
		windowMs: 60_000,
	},
} as const;
