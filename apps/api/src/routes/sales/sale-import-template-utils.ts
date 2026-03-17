import type { Prisma } from "generated/prisma/client";
import { PartnerStatus, SellerStatus } from "generated/prisma/enums";
import z from "zod";
import { prisma } from "@/lib/prisma";
import { BadRequestError } from "../_errors/bad-request-error";
import { loadProductSaleFieldSchema } from "./sale-dynamic-fields";
import {
	MAX_IMPORT_COLUMNS,
	SaleImportDynamicProductMappingSchema,
	type SaleImportFixedValues,
	SaleImportFixedValuesSchema,
	type SaleImportTemplateMapping,
	SaleImportTemplateMappingSchema,
} from "./sale-import-schemas";

const StoredSaleImportTemplateMappingSchema =
	SaleImportTemplateMappingSchema.extend({
		dynamicByProduct: z
			.array(SaleImportDynamicProductMappingSchema)
			.max(MAX_IMPORT_COLUMNS)
			.default([]),
	});

const StoredSaleImportFixedValuesSchema = SaleImportFixedValuesSchema.extend({
	parentProductId: z.uuid().optional(),
});

export function parseTemplateMappingJson(
	value: Prisma.JsonValue,
	options?: { selectedProductId?: string },
): SaleImportTemplateMapping {
	const parsed = StoredSaleImportTemplateMappingSchema.safeParse(value);
	if (!parsed.success) {
		throw new BadRequestError("Stored sale import template mapping is invalid");
	}

	const selectedMapping = options?.selectedProductId
		? parsed.data.dynamicByProduct.find(
				(dynamicMapping) =>
					dynamicMapping.productId === options.selectedProductId,
			)
		: parsed.data.dynamicByProduct[0];

	return {
		fields: parsed.data.fields,
		dynamicByProduct: selectedMapping ? [selectedMapping] : [],
	};
}

export function parseTemplateFixedValuesJson(
	value: Prisma.JsonValue,
	options?: { fallbackProductId?: string },
): SaleImportFixedValues {
	const parsed = StoredSaleImportFixedValuesSchema.safeParse(value);
	if (!parsed.success) {
		throw new BadRequestError(
			"Stored sale import template fixed values are invalid",
		);
	}

	const parentProductId =
		parsed.data.parentProductId ?? options?.fallbackProductId;
	if (!parentProductId) {
		throw new BadRequestError(
			"Stored sale import template fixed values are invalid",
		);
	}

	return {
		...parsed.data,
		parentProductId,
	};
}

export async function assertImportFixedValuesBelongToOrganization(
	organizationId: string,
	fixedValues: SaleImportFixedValues,
) {
	const company = await prisma.company.findFirst({
		where: {
			id: fixedValues.companyId,
			organizationId,
		},
		select: {
			id: true,
		},
	});

	if (!company) {
		throw new BadRequestError("Company not found for organization");
	}

	if (fixedValues.unitId) {
		const unit = await prisma.unit.findFirst({
			where: {
				id: fixedValues.unitId,
				companyId: fixedValues.companyId,
			},
			select: {
				id: true,
			},
		});

		if (!unit) {
			throw new BadRequestError("Unit not found for selected company");
		}
	}

	const parentProduct = await prisma.product.findFirst({
		where: {
			id: fixedValues.parentProductId,
			organizationId,
			isActive: true,
		},
		select: {
			id: true,
		},
	});

	if (!parentProduct) {
		throw new BadRequestError(
			"Parent product not found or inactive for organization",
		);
	}

	if (!fixedValues.responsible) {
		return;
	}

	if (fixedValues.responsible.type === "SELLER") {
		const seller = await prisma.seller.findFirst({
			where: {
				id: fixedValues.responsible.id,
				organizationId,
				status: SellerStatus.ACTIVE,
			},
			select: {
				id: true,
			},
		});

		if (!seller) {
			throw new BadRequestError("Responsible seller not found or inactive");
		}
	} else {
		const partner = await prisma.partner.findFirst({
			where: {
				id: fixedValues.responsible.id,
				organizationId,
				status: PartnerStatus.ACTIVE,
			},
			select: {
				id: true,
			},
		});

		if (!partner) {
			throw new BadRequestError("Responsible partner not found or inactive");
		}
	}
}

export async function assertTemplateMappingBelongsToOrganization(
	organizationId: string,
	params: {
		mapping: SaleImportTemplateMapping;
		selectedProductId: string;
	},
) {
	const { mapping, selectedProductId } = params;

	if (mapping.dynamicByProduct.length > 1) {
		throw new BadRequestError(
			"Dynamic mapping must contain at most one product",
		);
	}

	if (
		mapping.dynamicByProduct.length === 1 &&
		mapping.dynamicByProduct[0].productId !== selectedProductId
	) {
		throw new BadRequestError(
			"Dynamic mapping product must match selected import product",
		);
	}

	for (const productMapping of mapping.dynamicByProduct) {
		const product = await prisma.product.findFirst({
			where: {
				id: productMapping.productId,
				organizationId,
			},
			select: {
				id: true,
			},
		});

		if (!product) {
			throw new BadRequestError(
				`Dynamic mapping product not found: ${productMapping.productId}`,
			);
		}

		const dynamicSchema = await loadProductSaleFieldSchema(prisma, product.id);
		const dynamicFieldsById = new Set(
			dynamicSchema.map((field) => field.fieldId),
		);

		for (const fieldMapping of productMapping.fields) {
			if (!dynamicFieldsById.has(fieldMapping.fieldId)) {
				throw new BadRequestError(
					`Dynamic field ${fieldMapping.fieldId} is not available for product ${product.id}`,
				);
			}
		}
	}
}

export async function getOrganizationImportContext(slug: string) {
	const organization = await prisma.organization.findUnique({
		where: {
			slug,
		},
		select: {
			id: true,
		},
	});

	if (!organization) {
		throw new BadRequestError("Organization not found");
	}

	return organization;
}
