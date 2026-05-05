import type { GetOrganizationsSlugSalesDashboardPartners200 } from "@/http/generated";

type AvailableDynamicFieldOption =
	GetOrganizationsSlugSalesDashboardPartners200["dynamicFieldBreakdown"]["availableFields"][number];

export function dedupeAvailableDynamicFields(
	availableFields: AvailableDynamicFieldOption[],
	selectedFieldId: string | null,
) {
	const uniqueFieldsByKey = new Map<string, AvailableDynamicFieldOption>();
	const seenFieldIds = new Set<string>();

	for (const field of availableFields) {
		if (seenFieldIds.has(field.fieldId)) {
			continue;
		}

		seenFieldIds.add(field.fieldId);
		const normalizedLabel = field.label.trim().toLocaleLowerCase("pt-BR");
		const dedupeKey = `${field.type}:${normalizedLabel}`;
		const existingField = uniqueFieldsByKey.get(dedupeKey);

		if (!existingField) {
			uniqueFieldsByKey.set(dedupeKey, field);
			continue;
		}

		if (selectedFieldId && field.fieldId === selectedFieldId) {
			uniqueFieldsByKey.set(dedupeKey, field);
		}
	}

	return Array.from(uniqueFieldsByKey.values());
}
