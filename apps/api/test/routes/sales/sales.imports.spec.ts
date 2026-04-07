import {
	CustomerStatus,
	PartnerStatus,
	SaleDynamicFieldType,
	SaleStatus,
	SellerDocumentType,
	SellerStatus,
} from "generated/prisma/enums";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../../factories/make-user";
import { createTestApp } from "../../utils/test-app";

let app: Awaited<ReturnType<typeof createTestApp>>;

async function createFixture() {
	const { user, org } = await makeUser();

	const loginResponse = await request(app.server)
		.post("/sessions/password")
		.send({
			email: user.email,
			password: user.password,
		});
	expect(loginResponse.statusCode).toBe(200);

	const token = loginResponse.body.accessToken as string;
	const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

	const company = await prisma.company.create({
		data: {
			name: `Empresa ${suffix}`,
			organizationId: org.id,
		},
	});

	const unit = await prisma.unit.create({
		data: {
			name: `Unidade ${suffix}`,
			companyId: company.id,
		},
	});

	const seller = await prisma.seller.create({
		data: {
			organizationId: org.id,
			name: `Vendedor ${suffix}`,
			email: `seller-import-${suffix}@example.com`,
			phone: "55999999999",
			documentType: SellerDocumentType.CPF,
			document: `777777777${Math.floor(Math.random() * 9)}`,
			companyName: "Seller LTDA",
			state: "RS",
			status: SellerStatus.ACTIVE,
		},
	});

	const partner = await prisma.partner.create({
		data: {
			organizationId: org.id,
			name: `Partner ${suffix}`,
			email: `partner-import-${suffix}@example.com`,
			phone: "55999999998",
			documentType: "CPF",
			document: `888888888${Math.floor(Math.random() * 9)}`,
			companyName: "Partner LTDA",
			state: "RS",
			status: PartnerStatus.ACTIVE,
		},
	});

	const productA = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Produto A ${suffix}`,
			description: "Produto base da importação",
			isActive: true,
		},
	});

	const productB = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Produto B ${suffix}`,
			description: "Outro produto da organização",
			isActive: true,
		},
	});

	const productConsortiumParent = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Consorcio ${suffix}`,
			description: "Produto base para fallback de filho",
			isActive: true,
		},
	});

	const productConsortiumRealEstate = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: "Imoveis",
			description: "Filho de consorcio",
			parentId: productConsortiumParent.id,
			isActive: true,
		},
	});

	const productConsortiumProrata = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: "Pro-Rata Total",
			description: "Filho específico de imoveis",
			parentId: productConsortiumRealEstate.id,
			isActive: true,
		},
	});

	const productPathParent = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: `Linha Casa ${suffix}`,
			description: "Produto fora da árvore do consorcio",
			isActive: true,
		},
	});

	const productPathChild = await prisma.product.create({
		data: {
			organizationId: org.id,
			name: "Seguro Premium",
			description: "Filho fora da árvore do consorcio",
			parentId: productPathParent.id,
			isActive: true,
		},
	});

	const dynamicFieldA = await prisma.productSaleField.create({
		data: {
			productId: productA.id,
			label: "Descrição adicional",
			labelNormalized: "descricao adicional",
			type: SaleDynamicFieldType.TEXT,
			required: true,
		},
	});

	return {
		user,
		token,
		org,
		company,
		unit,
		seller,
		partner,
		productA,
		productB,
		productConsortiumParent,
		productConsortiumRealEstate,
		productConsortiumProrata,
		productPathParent,
		productPathChild,
		dynamicFieldA,
	};
}

function buildBaseMapping(
	fixture: Awaited<ReturnType<typeof createFixture>>,
	options?: {
		selectedProductId?: string;
		productColumn?: string;
		includeProductColumn?: boolean;
		dynamicByProduct?: Array<{
			productId: string;
			fields: Array<{ fieldId: string; columnKey: string }>;
		}>;
	},
) {
	const selectedProductId = options?.selectedProductId ?? fixture.productA.id;
	const includeProductColumn = options?.includeProductColumn ?? true;

	return {
		fields: {
			saleDateColumn: "data_venda",
			totalAmountColumn: "valor_total",
			...(includeProductColumn
				? {
						productColumn: options?.productColumn ?? "produto",
					}
				: {}),
			customerNameColumn: "cliente_nome",
			customerDocumentColumn: "cliente_documento",
			notesColumn: "observacoes",
			customerEmailColumn: "cliente_email",
			customerPhoneColumn: "cliente_telefone",
		},
		fixedValues: {
			companyId: fixture.company.id,
			unitId: fixture.unit.id,
			parentProductId: selectedProductId,
			responsible: {
				type: "SELLER" as const,
				id: fixture.seller.id,
			},
		},
		dynamicByProduct:
			options?.dynamicByProduct ??
			(selectedProductId === fixture.productA.id
				? [
						{
							productId: fixture.productA.id,
							fields: [
								{
									fieldId: fixture.dynamicFieldA.id,
									columnKey: "custom_a",
								},
							],
						},
					]
				: []),
	};
}

describe("sales import", () => {
	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("should create/list/update/delete import templates with single selected product", async () => {
		const fixture = await createFixture();
		const mapping = buildBaseMapping(fixture);
		const headerSignature = "sha256:template-signature-1";

		const createResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/import-templates`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Template Base",
				headerSignature,
				mapping: {
					fields: mapping.fields,
					dynamicByProduct: mapping.dynamicByProduct,
				},
				fixedValues: mapping.fixedValues,
			});

		expect(createResponse.statusCode).toBe(201);
		const templateId = createResponse.body.templateId as string;
		expect(templateId).toBeTypeOf("string");

		const listResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/import-templates?headerSignature=${encodeURIComponent(
					headerSignature,
				)}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(listResponse.statusCode).toBe(200);
		expect(listResponse.body.templates[0]).toMatchObject({
			id: templateId,
			isSuggested: true,
			fixedValues: {
				parentProductId: fixture.productA.id,
			},
		});
		expect(
			listResponse.body.templates[0].mapping.dynamicByProduct,
		).toHaveLength(1);

		const updateResponse = await request(app.server)
			.put(
				`/organizations/${fixture.org.slug}/sales/import-templates/${templateId}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Template Atualizado",
				headerSignature,
				mapping: {
					fields: mapping.fields,
					dynamicByProduct: mapping.dynamicByProduct,
				},
				fixedValues: {
					...mapping.fixedValues,
					responsible: {
						type: "PARTNER",
						id: fixture.partner.id,
					},
				},
			});

		expect(updateResponse.statusCode).toBe(204);

		const deleteResponse = await request(app.server)
			.delete(
				`/organizations/${fixture.org.slug}/sales/import-templates/${templateId}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);
		expect(deleteResponse.statusCode).toBe(204);
	});

	it("should upsert template when creating with an existing name", async () => {
		const fixture = await createFixture();
		const mapping = buildBaseMapping(fixture);

		const firstCreateResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/import-templates`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Template Reutilizado",
				headerSignature: "sha256:template-upsert-1",
				mapping: {
					fields: mapping.fields,
					dynamicByProduct: mapping.dynamicByProduct,
				},
				fixedValues: mapping.fixedValues,
			});

		expect(firstCreateResponse.statusCode).toBe(201);
		const templateId = firstCreateResponse.body.templateId as string;
		expect(templateId).toBeTypeOf("string");

		const secondCreateResponse = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/import-templates`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				name: "Template Reutilizado",
				headerSignature: "sha256:template-upsert-2",
				mapping: {
					fields: mapping.fields,
					dynamicByProduct: mapping.dynamicByProduct,
				},
				fixedValues: {
					...mapping.fixedValues,
					responsible: {
						type: "PARTNER",
						id: fixture.partner.id,
					},
				},
			});

		expect(secondCreateResponse.statusCode).toBe(201);
		expect(secondCreateResponse.body.templateId).toBe(templateId);

		const listResponse = await request(app.server)
			.get(`/organizations/${fixture.org.slug}/sales/import-templates`)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(listResponse.statusCode).toBe(200);

		const templatesWithSameName = listResponse.body.templates.filter(
			(template: { name: string }) => template.name === "Template Reutilizado",
		);
		expect(templatesWithSameName).toHaveLength(1);
		expect(templatesWithSameName[0]).toMatchObject({
			id: templateId,
			headerSignature: "sha256:template-upsert-2",
			fixedValues: {
				parentProductId: fixture.productA.id,
				responsible: {
					type: "PARTNER",
					id: fixture.partner.id,
				},
			},
		});
	});

	it("should import with partial success, keep status pending and without commissions", async () => {
		const fixture = await createFixture();
		const mapping = buildBaseMapping(fixture);

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/imports`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fileType: "CSV",
				headerSignature: "sha256:partial-success",
				rows: [
					{
						data_venda: "2026-03-15",
						valor_total: "1.350,75",
						produto: fixture.productA.name,
						cliente_nome: "Cliente Importado 01",
						cliente_documento: "390.533.447-05",
						cliente_email: "cliente01@example.com",
						cliente_telefone: "(51) 99999-9999",
						observacoes: "Linha válida",
						custom_a: "Campo dinâmico A",
					},
					{
						data_venda: "2026-03-16",
						valor_total: "valor-invalido",
						produto: fixture.productA.name,
						cliente_nome: "Cliente Importado 02",
						cliente_documento: "529.982.247-25",
						cliente_email: "cliente02@example.com",
						cliente_telefone: "(51) 98888-8888",
						observacoes: "Linha inválida",
						custom_a: "Campo dinâmico A",
					},
				],
				mapping,
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.totalRows).toBe(2);
		expect(response.body.importedRows).toBe(1);
		expect(response.body.failedRows).toBe(1);
		expect(response.body.failures[0]).toMatchObject({
			code: "TOTAL_AMOUNT_INVALID",
			field: mapping.fields.totalAmountColumn,
		});

		const saleId = response.body.createdSaleIds[0] as string;
		const sale = await prisma.sale.findUnique({
			where: { id: saleId },
			include: {
				commissions: true,
				customer: true,
			},
		});
		expect(sale?.status).toBe(SaleStatus.PENDING);
		expect(sale?.commissions).toHaveLength(0);
		expect(sale?.customer.status).toBe(CustomerStatus.ACTIVE);
	});

	it("should import without explicitly selecting responsible", async () => {
		const fixture = await createFixture();
		const mapping = buildBaseMapping(fixture);

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/imports`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fileType: "CSV",
				headerSignature: "sha256:no-responsible",
				rows: [
					{
						data_venda: "2026-03-17",
						valor_total: "890,50",
						produto: fixture.productA.name,
						cliente_nome: "Cliente Sem Responsável",
						cliente_documento: "390.533.447-05",
						observacoes: "Importação sem responsável fixo",
						custom_a: "ok",
					},
				],
				mapping: {
					...mapping,
					fixedValues: {
						companyId: mapping.fixedValues.companyId,
						unitId: mapping.fixedValues.unitId,
						parentProductId: mapping.fixedValues.parentProductId,
					},
				},
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.importedRows).toBe(1);
		expect(response.body.failedRows).toBe(0);

		const importedSale = await prisma.sale.findUnique({
			where: {
				id: response.body.createdSaleIds[0],
			},
			select: {
				responsibleType: true,
				responsibleId: true,
			},
		});

		expect(importedSale?.responsibleType).toBeNull();
		expect(importedSale?.responsibleId).toBeNull();
	});

	it("should use selected product when product column is not mapped", async () => {
		const fixture = await createFixture();
		const mapping = buildBaseMapping(fixture, {
			includeProductColumn: false,
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/imports`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fileType: "CSV",
				headerSignature: "sha256:no-product-column",
				rows: [
					{
						data_venda: "2026-03-20",
						valor_total: "1200",
						cliente_nome: "Cliente Sem Coluna Produto",
						cliente_documento: "390.533.447-05",
						custom_a: "Campo A",
					},
				],
				mapping,
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.importedRows).toBe(1);
		expect(response.body.failedRows).toBe(0);

		const importedSale = await prisma.sale.findUnique({
			where: { id: response.body.createdSaleIds[0] },
			select: { productId: true },
		});
		expect(importedSale?.productId).toBe(fixture.productA.id);
	});

	it("should resolve best child from selected product tree", async () => {
		const fixture = await createFixture();
		const mapping = buildBaseMapping(fixture, {
			selectedProductId: fixture.productConsortiumParent.id,
			dynamicByProduct: [],
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/imports`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fileType: "CSV",
				headerSignature: "sha256:tree-best-child",
				rows: [
					{
						data_venda: "2026-03-22",
						valor_total: "1950",
						produto: "IMÓVEIS PRÓ-RATA TOTAL",
						cliente_nome: "Cliente Escopo Pai",
						cliente_documento: "390.533.447-05",
					},
				],
				mapping,
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.importedRows).toBe(1);
		expect(response.body.failedRows).toBe(0);

		const importedSale = await prisma.sale.findUnique({
			where: { id: response.body.createdSaleIds[0] },
			select: { productId: true },
		});
		expect(importedSale?.productId).toBe(fixture.productConsortiumProrata.id);
	});

	it("should fallback to selected product when no child match is found", async () => {
		const fixture = await createFixture();
		const mapping = buildBaseMapping(fixture, {
			selectedProductId: fixture.productConsortiumParent.id,
			dynamicByProduct: [],
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/imports`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fileType: "CSV",
				headerSignature: "sha256:tree-fallback-parent",
				rows: [
					{
						data_venda: "2026-03-22",
						valor_total: "1750",
						produto: "produto sem correspondencia filho",
						cliente_nome: "Cliente Fallback Pai",
						cliente_documento: "390.533.447-05",
					},
				],
				mapping,
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.importedRows).toBe(1);
		expect(response.body.failedRows).toBe(0);

		const importedSale = await prisma.sale.findUnique({
			where: { id: response.body.createdSaleIds[0] },
			select: { productId: true },
		});
		expect(importedSale?.productId).toBe(fixture.productConsortiumParent.id);
	});

	it("should not escape selected product tree when excel text points outside", async () => {
		const fixture = await createFixture();
		const mapping = buildBaseMapping(fixture, {
			selectedProductId: fixture.productConsortiumParent.id,
			dynamicByProduct: [],
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/imports`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fileType: "CSV",
				headerSignature: "sha256:tree-restriction",
				rows: [
					{
						data_venda: "2026-03-22",
						valor_total: "1725",
						produto: fixture.productPathChild.name,
						cliente_nome: "Cliente Fora Escopo",
						cliente_documento: "529.982.247-25",
					},
				],
				mapping,
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.importedRows).toBe(1);
		expect(response.body.failedRows).toBe(0);

		const importedSale = await prisma.sale.findUnique({
			where: { id: response.body.createdSaleIds[0] },
			select: { productId: true },
		});
		expect(importedSale?.productId).toBe(fixture.productConsortiumParent.id);
	});

	it("should reject payload without selected import product", async () => {
		const fixture = await createFixture();
		const mapping = buildBaseMapping(fixture);

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/imports`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fileType: "CSV",
				headerSignature: "sha256:missing-selected-product",
				rows: [
					{
						data_venda: "2026-03-15",
						valor_total: "1000",
						produto: fixture.productA.name,
						cliente_nome: "Cliente 01",
						cliente_documento: "39053344705",
						custom_a: "x",
					},
				],
				mapping: {
					...mapping,
					fixedValues: {
						companyId: mapping.fixedValues.companyId,
						unitId: mapping.fixedValues.unitId,
					},
				},
			});

		expect(response.statusCode).toBe(400);
	});

	it("should reject dynamic mapping with more than one product", async () => {
		const fixture = await createFixture();
		const mapping = buildBaseMapping(fixture, {
			dynamicByProduct: [
				{
					productId: fixture.productA.id,
					fields: [
						{
							fieldId: fixture.dynamicFieldA.id,
							columnKey: "custom_a",
						},
					],
				},
				{
					productId: fixture.productB.id,
					fields: [],
				},
			],
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/imports`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fileType: "CSV",
				headerSignature: "sha256:dynamic-many-products",
				rows: [
					{
						data_venda: "2026-03-15",
						valor_total: "1000",
						produto: fixture.productA.name,
						cliente_nome: "Cliente 01",
						cliente_documento: "39053344705",
						custom_a: "x",
					},
				],
				mapping,
			});

		expect(response.statusCode).toBe(400);
	});

	it("should reject dynamic mapping when product differs from selected product", async () => {
		const fixture = await createFixture();
		const mapping = buildBaseMapping(fixture, {
			dynamicByProduct: [
				{
					productId: fixture.productB.id,
					fields: [],
				},
			],
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/imports`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fileType: "CSV",
				headerSignature: "sha256:dynamic-product-mismatch",
				rows: [
					{
						data_venda: "2026-03-15",
						valor_total: "1000",
						produto: fixture.productA.name,
						cliente_nome: "Cliente 01",
						cliente_documento: "39053344705",
						custom_a: "x",
					},
				],
				mapping,
			});

		expect(response.statusCode).toBe(400);
	});

	it("should ignore unavailable dynamic fields while importing sales", async () => {
		const fixture = await createFixture();
		const mapping = buildBaseMapping(fixture, {
			selectedProductId: fixture.productB.id,
			dynamicByProduct: [
				{
					productId: fixture.productB.id,
					fields: [
						{
							fieldId: fixture.dynamicFieldA.id,
							columnKey: "custom_a",
						},
					],
				},
			],
		});

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/imports`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fileType: "CSV",
				headerSignature: "sha256:ignore-unavailable-dynamic-fields",
				rows: [
					{
						data_venda: "2026-03-15",
						valor_total: "1000",
						produto: fixture.productB.name,
						cliente_nome: "Cliente 01",
						cliente_documento: "39053344705",
						custom_a: "campo obsoleto",
					},
				],
				mapping,
			});

		expect(response.statusCode).toBe(200);
		expect(response.body.importedRows).toBe(1);
		expect(response.body.failedRows).toBe(0);

		const importedSale = await prisma.sale.findUnique({
			where: { id: response.body.createdSaleIds[0] },
			select: {
				productId: true,
				dynamicFieldValues: true,
			},
		});
		expect(importedSale?.productId).toBe(fixture.productB.id);
		expect(importedSale?.dynamicFieldValues).toEqual({});
	});

	it("should keep legacy templates compatible by inferring selected product from mapping", async () => {
		const fixture = await createFixture();
		const headerSignature = "sha256:legacy-template";

		await prisma.saleImportTemplate.create({
			data: {
				organizationId: fixture.org.id,
				name: "Template legado",
				headerSignature,
				mappingJson: {
					fields: {
						saleDateColumn: "data_venda",
						totalAmountColumn: "valor_total",
						productColumn: "produto",
						customerNameColumn: "cliente_nome",
						customerDocumentColumn: "cliente_documento",
					},
					dynamicByProduct: [
						{
							productId: fixture.productA.id,
							fields: [
								{
									fieldId: fixture.dynamicFieldA.id,
									columnKey: "custom_a",
								},
							],
						},
						{
							productId: fixture.productB.id,
							fields: [],
						},
					],
				},
				fixedValuesJson: {
					companyId: fixture.company.id,
					unitId: fixture.unit.id,
				},
				createdById: fixture.user.id,
			},
		});

		const listResponse = await request(app.server)
			.get(
				`/organizations/${fixture.org.slug}/sales/import-templates?headerSignature=${encodeURIComponent(
					headerSignature,
				)}`,
			)
			.set("Authorization", `Bearer ${fixture.token}`);

		expect(listResponse.statusCode).toBe(200);
		expect(listResponse.body.templates).toHaveLength(1);
		expect(listResponse.body.templates[0].fixedValues.parentProductId).toBe(
			fixture.productA.id,
		);
		expect(
			listResponse.body.templates[0].mapping.dynamicByProduct,
		).toHaveLength(1);
		expect(
			listResponse.body.templates[0].mapping.dynamicByProduct[0].productId,
		).toBe(fixture.productA.id);
	});

	it("should reject selected product from another organization", async () => {
		const fixture = await createFixture();
		const otherFixture = await createFixture();
		const mapping = buildBaseMapping(fixture);

		const response = await request(app.server)
			.post(`/organizations/${fixture.org.slug}/sales/imports`)
			.set("Authorization", `Bearer ${fixture.token}`)
			.send({
				fileType: "CSV",
				headerSignature: "sha256:foreign-parent-product",
				rows: [
					{
						data_venda: "2026-03-15",
						valor_total: "1000",
						produto: fixture.productA.name,
						cliente_nome: "Cliente 01",
						cliente_documento: "39053344705",
						custom_a: "x",
					},
				],
				mapping: {
					...mapping,
					fixedValues: {
						...mapping.fixedValues,
						parentProductId: otherFixture.productA.id,
					},
				},
			});

		expect(response.statusCode).toBe(400);
	});
});
