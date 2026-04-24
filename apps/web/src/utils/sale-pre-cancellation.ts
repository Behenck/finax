type SaleDelinquencySummaryLike = {
	openCount: number;
};

export function normalizePreCancellationDelinquencyThreshold(
	threshold: number | null | undefined,
) {
	if (
		typeof threshold !== "number" ||
		!Number.isInteger(threshold) ||
		threshold < 1
	) {
		return null;
	}

	return threshold;
}

export function isSaleInPreCancellation(params: {
	threshold: number | null | undefined;
	summary: SaleDelinquencySummaryLike;
}) {
	const threshold = normalizePreCancellationDelinquencyThreshold(
		params.threshold,
	);

	return threshold !== null && params.summary.openCount >= threshold;
}
