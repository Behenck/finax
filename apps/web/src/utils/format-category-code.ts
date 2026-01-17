export function formatCategoryCode(value: string) {
	const digits = value.replace(/\D/g, "");

	if (!digits) return "";

	const groups = [1, 1, 2, 3, 4]; // padrão base
	const result: string[] = [];

	let cursor = 0;

	for (let i = 0; i < groups.length && cursor < digits.length; i++) {
		const size = groups[i];
		const part = digits.slice(cursor, cursor + size);

		if (part.length) {
			result.push(part);
			cursor += size;
		}
	}

	// Se ainda sobrar número, continua agrupando de 4 em 4
	while (cursor < digits.length) {
		result.push(digits.slice(cursor, cursor + 4));
		cursor += 4;
	}

	return result.join(".");
}
