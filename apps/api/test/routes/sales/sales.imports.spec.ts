import {
  CustomerDocumentType,
  CustomerPersonType,
  CustomerStatus,
  PartnerStatus,
  Role,
  SaleCommissionInstallmentStatus,
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

  const dynamicFieldCota = await prisma.productSaleField.create({
    data: {
      productId: productConsortiumRealEstate.id,
      label: "Cota",
      labelNormalized: "cota",
      type: SaleDynamicFieldType.NUMBER,
      required: false,
    },
  });

  const supervisorUser = await prisma.user.create({
    data: {
      name: `Supervisor ${suffix}`,
      email: `supervisor-import-${suffix}@example.com`,
      emailVerifiedAt: new Date(),
    },
  });
  const supervisor = await prisma.member.create({
    data: {
      organizationId: org.id,
      userId: supervisorUser.id,
      role: Role.SUPERVISOR,
    },
    include: {
      user: true,
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
    dynamicFieldCota,
    supervisor,
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

  it("should preview and apply JSON sale import with customers, groups and commissions", async () => {
    const fixture = await createFixture();
    const existingCustomer = await prisma.customer.create({
      data: {
        organizationId: fixture.org.id,
        personType: CustomerPersonType.PF,
        documentType: CustomerDocumentType.CPF,
        documentNumber: "39053344705",
        name: "Cliente Existente",
        status: CustomerStatus.ACTIVE,
      },
    });
    const payload = {
      parentProductId: fixture.productConsortiumParent.id,
      dynamicFieldMappings: [
        {
          fieldId: fixture.dynamicFieldCota.id,
          jsonKey: "cota",
        },
      ],
      cotas: [
        {
          contrato: "",
          cota: 5134,
          data_adesao: "2026-03-10",
          data_pagamento: "2026-03-12",
          cliente: {
            nome: "Cliente Existente Atualizado",
            email: "cliente-existente@example.com",
            telefone: "5599345315",
            cpf_cnpj: existingCustomer.documentNumber,
          },
          vendedor: {
            nome: fixture.seller.name,
            email: fixture.seller.email,
          },
          unidade: fixture.unit.name,
          status: "Não confirmada",
          administradora: "Racon",
          servico: "imovel",
          grupo: "1533",
          credito: 1_100_000,
          porcentagem_amortizacao: 50,
          porcentagem_taxa_administracao: 22,
          tipo_parcela_antes_contemplacao: "diluida",
          prazo: 2000,
          comissoes: {
            unidade: [
              {
                comissionado: {
                  tipo: "Unidade",
                  nome: fixture.unit.name,
                },
                comissoes: [{ parcela: 1, porcentagem: 0.2, valor: 2200 }],
              },
            ],
            vendedor: [
              {
                comissionado: {
                  tipo: "Vendedor",
                  nome: fixture.seller.name,
                  email: fixture.seller.email,
                },
                comissoes: [{ parcela: 1, porcentagem: 0.3, valor: 3300 }],
              },
            ],
            terceiros: [
              {
                comissionado: {
                  tipo: "Usuário",
                  id: 11,
                  nome: fixture.supervisor.user.name,
                  email: fixture.supervisor.user.email,
                },
                comissoes: [{ parcela: 1, porcentagem: 0.1, valor: 1100 }],
              },
              {
                comissionado: {
                  tipo: "Outro",
                  id: "externo-99",
                  nome: "Indicador externo",
                  email: "indicador@example.com",
                },
                comissoes: [{ parcela: 1, porcentagem: 0.05, valor: 550 }],
              },
            ],
          },
        },
        {
          cota: 5135,
          data_pagamento: "2026-03-13",
          cliente: {
            nome: "Cliente Novo JSON",
            email: "cliente-novo-json@example.com",
            telefone: "5599345316",
            cpf_cnpj: "52998224725",
          },
          vendedor: {
            nome: fixture.seller.name,
            email: fixture.seller.email,
          },
          unidade: fixture.unit.name,
          status: "Não confirmada",
          servico: "imovel",
          credito: 500_000,
          comissoes: {
            unidade: [],
            vendedor: [],
            terceiros: [],
          },
        },
      ],
    };

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send(payload);

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body).toMatchObject({
      totalRows: 2,
      validRows: 2,
      invalidRows: 0,
      hasCommissions: true,
    });
    expect(previewResponse.body.unitGroups[0].suggestions[0]).toMatchObject({
      companyId: fixture.company.id,
      unitId: fixture.unit.id,
    });
    expect(
      previewResponse.body.responsibleGroups[0].suggestions[0],
    ).toMatchObject({
      sellerId: fixture.seller.id,
    });

    const unitGroup = previewResponse.body.unitGroups[0];
    const responsibleGroup = previewResponse.body.responsibleGroups[0];
    const commissionGroups = previewResponse.body
      .commissionBeneficiaryGroups as Array<{
      key: string;
      section: "unidade" | "vendedor" | "terceiros";
      suggestions: Array<{ type: string; id: string }>;
    }>;
    const resolutionBySection = {
      unidade: commissionGroups
        .find((group) => group.section === "unidade")
        ?.suggestions.find((suggestion) => suggestion.type === "UNIT"),
      vendedor: commissionGroups
        .find((group) => group.section === "vendedor")
        ?.suggestions.find((suggestion) => suggestion.type === "SELLER"),
      terceiros: commissionGroups
        .find((group) => group.section === "terceiros")
        ?.suggestions.find((suggestion) => suggestion.type === "SUPERVISOR"),
    };

    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        ...payload,
        unitResolutions: [
          {
            key: unitGroup.key,
            companyId: fixture.company.id,
            unitId: fixture.unit.id,
          },
        ],
        responsibleResolutions: [
          {
            key: responsibleGroup.key,
            sellerId: fixture.seller.id,
          },
        ],
        commissionBeneficiaryResolutions: commissionGroups.map((group) => {
          const suggestion =
            group.section === "terceiros"
              ? group.suggestions.find(
                  (candidate) => candidate.type === "SUPERVISOR",
                )
              : resolutionBySection[group.section];
          if (!suggestion) {
            return {
              key: group.key,
              recipientType: "OTHER",
              beneficiaryLabel: "Indicador externo",
            };
          }
          return {
            key: group.key,
            recipientType: suggestion.type,
            beneficiaryId: suggestion.id,
          };
        }),
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(2);
    expect(applyResponse.body.failedRows).toBe(0);

    const importedSale = await prisma.sale.findUnique({
      where: { id: applyResponse.body.createdSaleIds[0] },
      include: {
        customer: true,
        commissions: {
          include: {
            installments: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    expect(importedSale?.customerId).toBe(existingCustomer.id);
    expect(importedSale?.productId).toBe(
      fixture.productConsortiumRealEstate.id,
    );
    expect(importedSale?.saleDate.toISOString().slice(0, 10)).toBe(
      "2026-03-12",
    );
    expect(importedSale?.totalAmount).toBe(110_000_000);
    expect(importedSale?.status).toBe(SaleStatus.PENDING);
    expect(importedSale?.responsibleId).toBe(fixture.seller.id);
    expect(importedSale?.dynamicFieldValues).toEqual({
      [fixture.dynamicFieldCota.id]: 5134,
    });
    expect(importedSale?.commissions).toHaveLength(4);
    expect(
      importedSale?.commissions.map((commission) => ({
        recipientType: commission.recipientType,
        beneficiaryLabel: commission.beneficiaryLabel,
        totalPercentage: commission.totalPercentage,
        amount: commission.installments[0]?.amount,
      })),
    ).toEqual([
      {
        recipientType: "UNIT",
        beneficiaryLabel: `${fixture.company.name} -> ${fixture.unit.name}`,
        totalPercentage: 2000,
        amount: 220_000,
      },
      {
        recipientType: "SELLER",
        beneficiaryLabel: fixture.seller.name,
        totalPercentage: 3000,
        amount: 330_000,
      },
      {
        recipientType: "SUPERVISOR",
        beneficiaryLabel: fixture.supervisor.user.name,
        totalPercentage: 1000,
        amount: 110_000,
      },
      {
        recipientType: "OTHER",
        beneficiaryLabel: "Indicador externo",
        totalPercentage: 500,
        amount: 55_000,
      },
    ]);

    const existingCustomersAfterImport = await prisma.customer.count({
      where: {
        organizationId: fixture.org.id,
        documentType: CustomerDocumentType.CPF,
        documentNumber: existingCustomer.documentNumber,
      },
    });
    const newCustomer = await prisma.customer.findFirst({
      where: {
        organizationId: fixture.org.id,
        documentNumber: "52998224725",
      },
    });
    expect(existingCustomersAfterImport).toBe(1);
    expect(newCustomer?.name).toBe("Cliente Novo JSON");
  });

  it("should preview and apply JSON sale import using customer phone when cpf_cnpj is missing", async () => {
    const fixture = await createFixture();
    const payload = {
      parentProductId: fixture.productConsortiumParent.id,
      cotas: [
        {
          cota: 5201,
          data_pagamento: "2026-03-14",
          cliente: {
            nome: "Cliente Somente Telefone",
            email: "cliente-somente-telefone@example.com",
            telefone: "(51) 99999-1234",
          },
          vendedor: {
            nome: fixture.seller.name,
            email: fixture.seller.email,
          },
          unidade: fixture.unit.name,
          status: "Não confirmada",
          servico: "imovel",
          credito: 250_000,
        },
      ],
    };

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send(payload);

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body).toMatchObject({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
    });
    expect(previewResponse.body.rows[0].customerDocument).toBeNull();

    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        ...payload,
        unitResolutions: [
          {
            key: previewResponse.body.unitGroups[0].key,
            companyId: fixture.company.id,
            unitId: fixture.unit.id,
          },
        ],
        responsibleResolutions: [
          {
            key: previewResponse.body.responsibleGroups[0].key,
            sellerId: fixture.seller.id,
          },
        ],
        commissionBeneficiaryResolutions: [],
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(1);
    expect(applyResponse.body.failedRows).toBe(0);

    const importedSale = await prisma.sale.findUnique({
      where: { id: applyResponse.body.createdSaleIds[0] },
      include: {
        customer: true,
      },
    });

    expect(importedSale?.customer).toMatchObject({
      personType: CustomerPersonType.PF,
      documentType: CustomerDocumentType.OTHER,
      documentNumber: "51999991234",
      phone: "51999991234",
      name: "Cliente Somente Telefone",
    });
  });

  it("should import JSON sale without responsible seller selection", async () => {
    const fixture = await createFixture();
    const payload = {
      parentProductId: fixture.productConsortiumParent.id,
      cotas: [
        {
          cota: 5209,
          data_pagamento: "2026-03-14",
          cliente: {
            nome: "Cliente Sem Responsável",
            telefone: "51999990001",
          },
          vendedor: {
            nome: "",
            email: "",
          },
          unidade: fixture.unit.name,
          status: "Não confirmada",
          servico: "imovel",
          credito: 250_000,
        },
      ],
    };

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send(payload);

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body).toMatchObject({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      responsibleGroups: [],
    });
    expect(previewResponse.body.rows[0].responsibleGroupKey).toBeNull();

    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        ...payload,
        unitResolutions: [
          {
            key: previewResponse.body.unitGroups[0].key,
            companyId: fixture.company.id,
            unitId: fixture.unit.id,
          },
        ],
        responsibleResolutions: [],
        commissionBeneficiaryResolutions: [],
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(1);
    expect(applyResponse.body.failedRows).toBe(0);

    const importedSale = await prisma.sale.findUnique({
      where: { id: applyResponse.body.createdSaleIds[0] },
      select: {
        responsibleType: true,
        responsibleId: true,
      },
    });

    expect(importedSale).toMatchObject({
      responsibleType: null,
      responsibleId: null,
    });
  });

  it("should import JSON sale with responsible selected by unit group", async () => {
    const fixture = await createFixture();
    const payload = {
      parentProductId: fixture.productConsortiumParent.id,
      cotas: [
        {
          cota: 5210,
          data_pagamento: "2026-03-14",
          cliente: {
            nome: "Cliente Responsável Unidade",
            telefone: "51999990002",
          },
          vendedor: {
            nome: "",
            email: "",
          },
          unidade: fixture.unit.name,
          status: "Não confirmada",
          servico: "imovel",
          credito: 250_000,
        },
      ],
    };

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send(payload);

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body.invalidRows).toBe(0);

    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        ...payload,
        unitResolutions: [
          {
            key: previewResponse.body.unitGroups[0].key,
            companyId: fixture.company.id,
            unitId: fixture.unit.id,
          },
        ],
        responsibleResolutions: [
          {
            key: previewResponse.body.unitGroups[0].key,
            type: "PARTNER",
            id: fixture.partner.id,
          },
        ],
        commissionBeneficiaryResolutions: [],
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(1);
    expect(applyResponse.body.failedRows).toBe(0);

    const importedSale = await prisma.sale.findUnique({
      where: { id: applyResponse.body.createdSaleIds[0] },
      select: {
        responsibleType: true,
        responsibleId: true,
      },
    });

    expect(importedSale).toMatchObject({
      responsibleType: "PARTNER",
      responsibleId: fixture.partner.id,
    });
  });

  it("should import JSON sales with company-only sale location and all responsible types", async () => {
    const fixture = await createFixture();
    const responsibleCases = [
      {
        unitName: "Grupo Empresa",
        customerName: "Cliente Responsável Empresa",
        phone: "51999990011",
        resolution: { type: "COMPANY", id: fixture.company.id },
        expected: {
          responsibleType: "COMPANY",
          responsibleId: fixture.company.id,
          responsibleLabel: null,
        },
      },
      {
        unitName: "Grupo Unidade",
        customerName: "Cliente Responsável Unidade",
        phone: "51999990012",
        resolution: { type: "UNIT", id: fixture.unit.id },
        expected: {
          responsibleType: "UNIT",
          responsibleId: fixture.unit.id,
          responsibleLabel: null,
        },
      },
      {
        unitName: "Grupo Vendedor",
        customerName: "Cliente Responsável Vendedor",
        phone: "51999990013",
        resolution: { type: "SELLER", id: fixture.seller.id },
        expected: {
          responsibleType: "SELLER",
          responsibleId: fixture.seller.id,
          responsibleLabel: null,
        },
      },
      {
        unitName: "Grupo Parceiro",
        customerName: "Cliente Responsável Parceiro",
        phone: "51999990014",
        resolution: { type: "PARTNER", id: fixture.partner.id },
        expected: {
          responsibleType: "PARTNER",
          responsibleId: fixture.partner.id,
          responsibleLabel: null,
        },
      },
      {
        unitName: "Grupo Supervisor",
        customerName: "Cliente Responsável Supervisor",
        phone: "51999990015",
        resolution: { type: "SUPERVISOR", id: fixture.supervisor.id },
        expected: {
          responsibleType: "SUPERVISOR",
          responsibleId: fixture.supervisor.id,
          responsibleLabel: null,
        },
      },
      {
        unitName: "Grupo Outro",
        customerName: "Cliente Responsável Outro",
        phone: "51999990016",
        resolution: { type: "OTHER", label: "Responsável externo" },
        expected: {
          responsibleType: "OTHER",
          responsibleId: null,
          responsibleLabel: "Responsável externo",
        },
      },
    ];
    const payload = {
      parentProductId: fixture.productConsortiumParent.id,
      cotas: responsibleCases.map((item, index) => ({
        cota: 5220 + index,
        data_pagamento: "2026-03-14",
        cliente: {
          nome: item.customerName,
          telefone: item.phone,
        },
        vendedor: {
          nome: "",
          email: "",
        },
        unidade: item.unitName,
        status: "Não confirmada",
        servico: "imovel",
        credito: 250_000,
      })),
    };

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send(payload);

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body.invalidRows).toBe(0);

    const unitGroupByName = new Map(
      previewResponse.body.unitGroups.map(
        (group: { key: string; name: string }) => [group.name, group],
      ),
    );
    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        ...payload,
        unitResolutions: responsibleCases.map((item) => ({
          key: unitGroupByName.get(item.unitName)?.key,
          companyId: fixture.company.id,
        })),
        responsibleResolutions: responsibleCases.map((item) => ({
          key: unitGroupByName.get(item.unitName)?.key,
          ...item.resolution,
        })),
        commissionBeneficiaryResolutions: [],
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(responsibleCases.length);
    expect(applyResponse.body.failedRows).toBe(0);

    const importedSales = await prisma.sale.findMany({
      where: { id: { in: applyResponse.body.createdSaleIds } },
      select: {
        id: true,
        companyId: true,
        unitId: true,
        responsibleType: true,
        responsibleId: true,
        responsibleLabel: true,
      },
    });
    const importedSaleById = new Map(
      importedSales.map((sale) => [sale.id, sale]),
    );

    for (const [index, item] of responsibleCases.entries()) {
      const sale = importedSaleById.get(
        applyResponse.body.createdSaleIds[index],
      );
      expect(sale).toMatchObject({
        companyId: fixture.company.id,
        unitId: null,
        ...item.expected,
      });
    }
  });

  it("should fail JSON import rows with an invalid sale responsible", async () => {
    const fixture = await createFixture();
    const payload = {
      parentProductId: fixture.productConsortiumParent.id,
      cotas: [
        {
          cota: 5230,
          data_pagamento: "2026-03-14",
          cliente: {
            nome: "Cliente Responsável Inválido",
            telefone: "51999990017",
          },
          vendedor: {
            nome: "",
            email: "",
          },
          unidade: "Grupo Responsável Inválido",
          status: "Não confirmada",
          servico: "imovel",
          credito: 250_000,
        },
      ],
    };

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send(payload);

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body.invalidRows).toBe(0);

    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        ...payload,
        unitResolutions: [
          {
            key: previewResponse.body.unitGroups[0].key,
            companyId: fixture.company.id,
          },
        ],
        responsibleResolutions: [
          {
            key: previewResponse.body.unitGroups[0].key,
            type: "SELLER",
            id: "00000000-0000-0000-0000-000000000000",
          },
        ],
        commissionBeneficiaryResolutions: [],
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(0);
    expect(applyResponse.body.failedRows).toBe(1);
    expect(applyResponse.body.failures[0].message).toContain(
      "Vendedor responsável não encontrado",
    );
  });

  it("should accept direct unit commission installments in JSON sale import", async () => {
    const fixture = await createFixture();
    const payload = {
      parentProductId: fixture.productConsortiumParent.id,
      cotas: [
        {
          cota: 5204,
          data_pagamento: "2026-03-14",
          cliente: {
            nome: "Cliente Comissão Unidade Direta",
            telefone: "51999998888",
          },
          vendedor: {
            nome: fixture.seller.name,
            email: fixture.seller.email,
          },
          unidade: fixture.unit.name,
          status: "Não confirmada",
          servico: "imovel",
          credito: 240_000,
          comissoes: {
            unidade: [
              { parcela: 1, porcentagem: 1, valor: 2400 },
              { parcela: 2, porcentagem: 0.5, valor: 1200 },
              { parcela: 7, porcentagem: 0, valor: 0 },
            ],
            vendedor: [],
            terceiros: [],
          },
        },
      ],
    };

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send(payload);

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body.invalidRows).toBe(0);
    expect(previewResponse.body.commissionBeneficiaryGroups).toHaveLength(1);
    expect(previewResponse.body.commissionBeneficiaryGroups[0]).toMatchObject({
      section: "unidade",
      name: fixture.unit.name,
    });

    const unitGroup = previewResponse.body.unitGroups[0];
    const responsibleGroup = previewResponse.body.responsibleGroups[0];
    const commissionGroup = previewResponse.body.commissionBeneficiaryGroups[0];
    const unitSuggestion = commissionGroup.suggestions.find(
      (suggestion: { type: string }) => suggestion.type === "UNIT",
    );

    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        ...payload,
        unitResolutions: [
          {
            key: unitGroup.key,
            companyId: fixture.company.id,
            unitId: fixture.unit.id,
          },
        ],
        responsibleResolutions: [
          {
            key: responsibleGroup.key,
            sellerId: fixture.seller.id,
          },
        ],
        commissionBeneficiaryResolutions: [
          {
            key: commissionGroup.key,
            recipientType: "UNIT",
            beneficiaryId: unitSuggestion.id,
          },
        ],
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(1);
    expect(applyResponse.body.failedRows).toBe(0);

    const importedSale = await prisma.sale.findUnique({
      where: { id: applyResponse.body.createdSaleIds[0] },
      include: {
        commissions: {
          include: {
            installments: {
              orderBy: { installmentNumber: "asc" },
            },
          },
        },
      },
    });

    expect(importedSale?.commissions).toHaveLength(1);
    expect(importedSale?.commissions[0]?.recipientType).toBe("UNIT");
    expect(
      importedSale?.commissions[0]?.installments.map((installment) => ({
        installmentNumber: installment.installmentNumber,
        percentage: installment.percentage,
        amount: installment.amount,
      })),
    ).toEqual([
      { installmentNumber: 1, percentage: 10_000, amount: 240_000 },
      { installmentNumber: 2, percentage: 5_000, amount: 120_000 },
      { installmentNumber: 7, percentage: 0, amount: 0 },
    ]);
  });

  it("should ignore empty JSON commission placeholders", async () => {
    const fixture = await createFixture();
    const payload = {
      parentProductId: fixture.productConsortiumParent.id,
      cotas: [
        {
          cota: 5205,
          data_pagamento: "2026-03-14",
          cliente: {
            nome: "Cliente Sem Comissão",
            telefone: "51999997777",
          },
          vendedor: {
            nome: fixture.seller.name,
            email: fixture.seller.email,
          },
          unidade: fixture.unit.name,
          status: "Não confirmada",
          servico: "imovel",
          credito: 250_000,
          comissoes: {
            unidade: [{}],
            vendedor: [
              {
                comissionado: {
                  nome: fixture.seller.name,
                  email: fixture.seller.email,
                },
                comissoes: [
                  {
                    parcela: 1,
                    porcentagem: 0,
                    valor: 0,
                  },
                ],
              },
            ],
            terceiros: [
              {
                comissionado: {
                  nome: "Sem comissão",
                  email: "sem-comissao@example.com",
                },
                comissoes: [
                  {
                    parcela: 0,
                    porcentagem: 0,
                    valor: 0,
                    data_pagamento: "0000-00-00",
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send(payload);

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body).toMatchObject({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
    });
    expect(previewResponse.body.rows[0].errors).toEqual([]);
    expect(previewResponse.body.commissionBeneficiaryGroups).toHaveLength(0);

    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        ...payload,
        unitResolutions: [
          {
            key: previewResponse.body.unitGroups[0].key,
            companyId: fixture.company.id,
            unitId: fixture.unit.id,
          },
        ],
        responsibleResolutions: [
          {
            key: previewResponse.body.responsibleGroups[0].key,
            sellerId: fixture.seller.id,
          },
        ],
        commissionBeneficiaryResolutions: [],
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(1);
    expect(applyResponse.body.failedRows).toBe(0);

    const importedSale = await prisma.sale.findUnique({
      where: { id: applyResponse.body.createdSaleIds[0] },
      include: {
        commissions: true,
      },
    });

    expect(importedSale?.commissions).toHaveLength(0);
  });

  it("should ignore direct zero-value seller commission placeholders", async () => {
    const fixture = await createFixture();
    const payload = {
      parentProductId: fixture.productConsortiumParent.id,
      cotas: [
        {
          cota: 5206,
          data_pagamento: "2026-05-14",
          cliente: {
            nome: "Cliente Comissão Vendedor Zerada",
            telefone: "51999996666",
          },
          vendedor: {
            nome: fixture.seller.name,
            email: fixture.seller.email,
          },
          unidade: fixture.unit.name,
          status: "Não confirmada",
          servico: "imovel",
          credito: 250_000,
          comissoes: {
            unidade: [],
            vendedor: [
              {
                parcela: 1,
                porcentagem: 0,
                data_vencimento: "2026-05-20",
                situacao: "Pago",
                data_pagamento: "0000-00-00",
                valor: 0,
              },
            ],
            terceiros: [],
          },
        },
      ],
    };

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send(payload);

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body).toMatchObject({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
    });
    expect(previewResponse.body.rows[0].errors).toEqual([]);
    expect(previewResponse.body.commissionBeneficiaryGroups).toHaveLength(0);

    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        ...payload,
        unitResolutions: [
          {
            key: previewResponse.body.unitGroups[0].key,
            companyId: fixture.company.id,
            unitId: fixture.unit.id,
          },
        ],
        responsibleResolutions: [
          {
            key: previewResponse.body.responsibleGroups[0].key,
            sellerId: fixture.seller.id,
          },
        ],
        commissionBeneficiaryResolutions: [],
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(1);
    expect(applyResponse.body.failedRows).toBe(0);

    const importedSale = await prisma.sale.findUnique({
      where: { id: applyResponse.body.createdSaleIds[0] },
      include: {
        commissions: true,
      },
    });

    expect(importedSale?.commissions).toHaveLength(0);
  });

  it("should resolve JSON dynamic select fields by option label", async () => {
    const fixture = await createFixture();
    const administratorField = await prisma.productSaleField.create({
      data: {
        productId: fixture.productConsortiumRealEstate.id,
        label: "Administradora",
        labelNormalized: "administradora",
        type: SaleDynamicFieldType.SELECT,
        required: false,
        options: {
          create: [
            {
              label: "Racon",
              labelNormalized: "racon",
              sortOrder: 0,
            },
            {
              label: "Embracon",
              labelNormalized: "embracon",
              sortOrder: 1,
            },
          ],
        },
      },
      include: {
        options: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    const raconOption = administratorField.options.find(
      (option) => option.label === "Racon",
    );
    expect(raconOption).toBeDefined();

    const payload = {
      parentProductId: fixture.productConsortiumParent.id,
      dynamicFieldMappings: [
        {
          fieldId: administratorField.id,
          jsonKey: "administradora",
        },
      ],
      cotas: [
        {
          cota: 5205,
          data_pagamento: "2026-03-14",
          cliente: {
            nome: "Cliente Administradora Label",
            telefone: "51999997777",
          },
          vendedor: {
            nome: fixture.seller.name,
            email: fixture.seller.email,
          },
          unidade: fixture.unit.name,
          status: "Não confirmada",
          servico: "imovel",
          credito: 250_000,
          administradora: "Racon",
        },
      ],
    };

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send(payload);

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body.invalidRows).toBe(0);

    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        ...payload,
        unitResolutions: [
          {
            key: previewResponse.body.unitGroups[0].key,
            companyId: fixture.company.id,
            unitId: fixture.unit.id,
          },
        ],
        responsibleResolutions: [
          {
            key: previewResponse.body.responsibleGroups[0].key,
            sellerId: fixture.seller.id,
          },
        ],
        commissionBeneficiaryResolutions: [],
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(1);
    expect(applyResponse.body.failedRows).toBe(0);

    const importedSale = await prisma.sale.findUnique({
      where: { id: applyResponse.body.createdSaleIds[0] },
      select: {
        dynamicFieldValues: true,
      },
    });

    expect(importedSale?.dynamicFieldValues).toMatchObject({
      [administratorField.id]: raconOption?.id,
    });
  });

  it("should import JSON commission installment status and dates", async () => {
    const fixture = await createFixture();
    const payload = {
      parentProductId: fixture.productConsortiumParent.id,
      cotas: [
        {
          cota: 5206,
          data_pagamento: "2026-03-12",
          cliente: {
            nome: "Cliente Datas Comissão",
            telefone: "51999996666",
          },
          vendedor: {
            nome: fixture.seller.name,
            email: fixture.seller.email,
          },
          unidade: fixture.unit.name,
          status: "Não confirmada",
          servico: "imovel",
          credito: 250_000,
          comissoes: {
            unidade: [],
            vendedor: [],
            terceiros: [
              {
                comissionado: {
                  tipo: "Usuário",
                  nome: fixture.supervisor.user.name,
                  email: fixture.supervisor.user.email,
                },
                comissoes: [
                  {
                    parcela: 1,
                    porcentagem: 0.1,
                    data_vencimento: "2026-03-14",
                    situacao: "Pendente",
                    data_pagamento: "0000-00-00",
                    valor: 250,
                  },
                  {
                    parcela: 2,
                    porcentagem: 0.2,
                    data_vencimento: "2026-04-14",
                    situacao: "Pago",
                    data_pagamento: "2026-04-15",
                    valor: 500,
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send(payload);

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body.invalidRows).toBe(0);

    const commissionGroup = previewResponse.body.commissionBeneficiaryGroups[0];
    const supervisorSuggestion = commissionGroup.suggestions.find(
      (suggestion: { type: string }) => suggestion.type === "SUPERVISOR",
    );

    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        ...payload,
        unitResolutions: [
          {
            key: previewResponse.body.unitGroups[0].key,
            companyId: fixture.company.id,
            unitId: fixture.unit.id,
          },
        ],
        responsibleResolutions: [
          {
            key: previewResponse.body.responsibleGroups[0].key,
            sellerId: fixture.seller.id,
          },
        ],
        commissionBeneficiaryResolutions: [
          {
            key: commissionGroup.key,
            recipientType: "SUPERVISOR",
            beneficiaryId: supervisorSuggestion.id,
          },
        ],
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(1);
    expect(applyResponse.body.failedRows).toBe(0);

    const importedSale = await prisma.sale.findUnique({
      where: { id: applyResponse.body.createdSaleIds[0] },
      include: {
        commissions: {
          include: {
            installments: {
              orderBy: { installmentNumber: "asc" },
            },
          },
        },
      },
    });

    expect(
      importedSale?.commissions[0]?.installments.map((installment) => ({
        installmentNumber: installment.installmentNumber,
        status: installment.status,
        expectedPaymentDate: installment.expectedPaymentDate
          ?.toISOString()
          .slice(0, 10),
        paymentDate:
          installment.paymentDate?.toISOString().slice(0, 10) ?? null,
      })),
    ).toEqual([
      {
        installmentNumber: 1,
        status: SaleCommissionInstallmentStatus.PENDING,
        expectedPaymentDate: "2026-03-14",
        paymentDate: null,
      },
      {
        installmentNumber: 2,
        status: SaleCommissionInstallmentStatus.PAID,
        expectedPaymentDate: "2026-04-14",
        paymentDate: "2026-04-15",
      },
    ]);
  });

  it("should import reversed JSON commission installment when situacao is composite", async () => {
    const fixture = await createFixture();
    const payload = {
      parentProductId: fixture.productConsortiumParent.id,
      cotas: [
        {
          cota: 5210,
          data_pagamento: "2026-03-12",
          cliente: {
            nome: "Cliente Comissão Estornada",
            telefone: "51999992222",
          },
          vendedor: {
            nome: fixture.seller.name,
            email: fixture.seller.email,
          },
          unidade: fixture.unit.name,
          status: "Não confirmada",
          servico: "imovel",
          credito: 250_000,
          comissoes: {
            unidade: [],
            vendedor: [],
            terceiros: [
              {
                comissionado: {
                  tipo: "Usuário",
                  nome: fixture.supervisor.user.name,
                  email: fixture.supervisor.user.email,
                },
                comissoes: [
                  {
                    parcela: 2,
                    porcentagem: 0.2,
                    data_vencimento: "2026-04-14",
                    situacao: "Estornada,Pago",
                    data_pagamento: "2026-04-15",
                    valor: -500,
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send(payload);

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body.invalidRows).toBe(0);

    const commissionGroup = previewResponse.body.commissionBeneficiaryGroups[0];
    const supervisorSuggestion = commissionGroup.suggestions.find(
      (suggestion: { type: string }) => suggestion.type === "SUPERVISOR",
    );

    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        ...payload,
        unitResolutions: [
          {
            key: previewResponse.body.unitGroups[0].key,
            companyId: fixture.company.id,
            unitId: fixture.unit.id,
          },
        ],
        responsibleResolutions: [
          {
            key: previewResponse.body.responsibleGroups[0].key,
            sellerId: fixture.seller.id,
          },
        ],
        commissionBeneficiaryResolutions: [
          {
            key: commissionGroup.key,
            recipientType: "SUPERVISOR",
            beneficiaryId: supervisorSuggestion.id,
          },
        ],
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(1);
    expect(applyResponse.body.failedRows).toBe(0);

    const importedSale = await prisma.sale.findUnique({
      where: { id: applyResponse.body.createdSaleIds[0] },
      include: {
        commissions: {
          include: {
            installments: {
              orderBy: { installmentNumber: "asc" },
            },
          },
        },
      },
    });

    expect(
      importedSale?.commissions[0]?.installments.map((installment) => ({
        installmentNumber: installment.installmentNumber,
        status: installment.status,
        amount: installment.amount,
        expectedPaymentDate: installment.expectedPaymentDate
          ?.toISOString()
          .slice(0, 10),
        paymentDate:
          installment.paymentDate?.toISOString().slice(0, 10) ?? null,
      })),
    ).toEqual([
      {
        installmentNumber: 2,
        status: SaleCommissionInstallmentStatus.REVERSED,
        amount: -50000,
        expectedPaymentDate: "2026-04-14",
        paymentDate: "2026-04-15",
      },
    ]);
  });

  it('should keep commission expected payment date null when data_vencimento is "0000-00-00"', async () => {
    const fixture = await createFixture();
    const payload = {
      parentProductId: fixture.productConsortiumParent.id,
      cotas: [
        {
          cota: 5209,
          data_pagamento: "2026-03-12",
          cliente: {
            nome: "Cliente Sem Vencimento Definido",
            telefone: "51999993333",
          },
          vendedor: {
            nome: fixture.seller.name,
            email: fixture.seller.email,
          },
          unidade: fixture.unit.name,
          status: "Não confirmada",
          servico: "imovel",
          credito: 250_000,
          comissoes: {
            unidade: [],
            vendedor: [],
            terceiros: [
              {
                comissionado: {
                  tipo: "Usuário",
                  nome: fixture.supervisor.user.name,
                  email: fixture.supervisor.user.email,
                },
                comissoes: [
                  {
                    parcela: 1,
                    porcentagem: 0.1,
                    data_vencimento: "0000-00-00",
                    situacao: "Pendente",
                    data_pagamento: "0000-00-00",
                    valor: 250,
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send(payload);

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body.invalidRows).toBe(0);

    const commissionGroup = previewResponse.body.commissionBeneficiaryGroups[0];
    const supervisorSuggestion = commissionGroup.suggestions.find(
      (suggestion: { type: string }) => suggestion.type === "SUPERVISOR",
    );

    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        ...payload,
        unitResolutions: [
          {
            key: previewResponse.body.unitGroups[0].key,
            companyId: fixture.company.id,
            unitId: fixture.unit.id,
          },
        ],
        responsibleResolutions: [
          {
            key: previewResponse.body.responsibleGroups[0].key,
            sellerId: fixture.seller.id,
          },
        ],
        commissionBeneficiaryResolutions: [
          {
            key: commissionGroup.key,
            recipientType: "SUPERVISOR",
            beneficiaryId: supervisorSuggestion.id,
          },
        ],
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(1);
    expect(applyResponse.body.failedRows).toBe(0);

    const importedSale = await prisma.sale.findUnique({
      where: { id: applyResponse.body.createdSaleIds[0] },
      include: {
        commissions: {
          include: {
            installments: {
              orderBy: { installmentNumber: "asc" },
            },
          },
        },
      },
    });

    expect(importedSale?.commissions).toHaveLength(1);
    expect(
      importedSale?.commissions[0]?.installments.map((installment) => ({
        installmentNumber: installment.installmentNumber,
        expectedPaymentDate: installment.expectedPaymentDate,
        paymentDate: installment.paymentDate,
      })),
    ).toEqual([
      {
        installmentNumber: 1,
        expectedPaymentDate: null,
        paymentDate: null,
      },
    ]);
  });

  it("should reject JSON commission installments with unknown status, paid without payment date, or reversed with positive amount", async () => {
    const fixture = await createFixture();

    const response = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        parentProductId: fixture.productConsortiumParent.id,
        cotas: [
          {
            cota: 5207,
            data_pagamento: "2026-03-12",
            cliente: {
              nome: "Cliente Situação Inválida",
              telefone: "51999995555",
            },
            vendedor: {
              nome: fixture.seller.name,
              email: fixture.seller.email,
            },
            unidade: fixture.unit.name,
            status: "Não confirmada",
            servico: "imovel",
            credito: 250_000,
            comissoes: {
              terceiros: [
                {
                  comissionado: {
                    tipo: "Usuário",
                    nome: fixture.supervisor.user.name,
                    email: fixture.supervisor.user.email,
                  },
                  comissoes: [
                    {
                      parcela: 1,
                      porcentagem: 0.1,
                      situacao: "Em análise",
                      valor: 250,
                    },
                  ],
                },
              ],
            },
          },
          {
            cota: 5208,
            data_pagamento: "2026-03-12",
            cliente: {
              nome: "Cliente Pago Sem Data",
              telefone: "51999994444",
            },
            vendedor: {
              nome: fixture.seller.name,
              email: fixture.seller.email,
            },
            unidade: fixture.unit.name,
            status: "Não confirmada",
            servico: "imovel",
            credito: 250_000,
            comissoes: {
              terceiros: [
                {
                  comissionado: {
                    tipo: "Usuário",
                    nome: fixture.supervisor.user.name,
                    email: fixture.supervisor.user.email,
                  },
                  comissoes: [
                    {
                      parcela: 1,
                      porcentagem: 0.1,
                      situacao: "Pago",
                      data_pagamento: "0000-00-00",
                      valor: 250,
                    },
                  ],
                },
              ],
            },
          },
          {
            cota: 5211,
            data_pagamento: "2026-03-12",
            cliente: {
              nome: "Cliente Estorno Positivo",
              telefone: "51999991111",
            },
            vendedor: {
              nome: fixture.seller.name,
              email: fixture.seller.email,
            },
            unidade: fixture.unit.name,
            status: "Não confirmada",
            servico: "imovel",
            credito: 250_000,
            comissoes: {
              terceiros: [
                {
                  comissionado: {
                    tipo: "Usuário",
                    nome: fixture.supervisor.user.name,
                    email: fixture.supervisor.user.email,
                  },
                  comissoes: [
                    {
                      parcela: 1,
                      porcentagem: 0.1,
                      situacao: "Estornada,Pago",
                      data_pagamento: "2026-03-13",
                      valor: 250,
                    },
                  ],
                },
              ],
            },
          },
        ],
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.invalidRows).toBe(3);
    expect(response.body.rows[0].errors).toContain(
      "Comissão inválida em terceiros[0]",
    );
    expect(response.body.rows[1].errors).toContain(
      "Comissão inválida em terceiros[0]",
    );
    expect(response.body.rows[2].errors).toContain(
      "Comissão inválida em terceiros[0]",
    );
  });

  it("should mark JSON import preview rows invalid without valid customer cpf_cnpj or phone", async () => {
    const fixture = await createFixture();

    const response = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        parentProductId: fixture.productConsortiumParent.id,
        cotas: [
          {
            cota: 5202,
            data_pagamento: "2026-03-14",
            cliente: {
              nome: "Cliente Sem Identificador",
              telefone: "abc",
            },
            vendedor: {
              nome: fixture.seller.name,
              email: fixture.seller.email,
            },
            unidade: fixture.unit.name,
            status: "Não confirmada",
            servico: "imovel",
            credito: 250_000,
          },
          {
            cota: 5203,
            data_pagamento: "2026-03-14",
            cliente: {
              nome: "Cliente Documento Inválido",
              telefone: "(51) 99999-5678",
              cpf_cnpj: "123",
            },
            vendedor: {
              nome: fixture.seller.name,
              email: fixture.seller.email,
            },
            unidade: fixture.unit.name,
            status: "Não confirmada",
            servico: "imovel",
            credito: 250_000,
          },
        ],
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.invalidRows).toBe(2);
    expect(response.body.rows[0].errors).toContain(
      "CPF/CNPJ ou telefone do cliente é obrigatório",
    );
    expect(response.body.rows[1].errors).toContain(
      "CPF/CNPJ do cliente inválido",
    );
  });

  it("should fail JSON import rows without confirmed commission beneficiary", async () => {
    const fixture = await createFixture();
    const payload = {
      parentProductId: fixture.productConsortiumParent.id,
      cotas: [
        {
          cota: 6001,
          data_pagamento: "2026-03-12",
          cliente: {
            nome: "Cliente Sem Comissionado",
            cpf_cnpj: "52998224725",
          },
          vendedor: {
            nome: fixture.seller.name,
            email: fixture.seller.email,
          },
          unidade: fixture.unit.name,
          status: "Não confirmada",
          servico: "imovel",
          credito: 100_000,
          comissoes: {
            terceiros: [
              {
                comissionado: {
                  tipo: "Usuário",
                  nome: "Pessoa sem vínculo",
                  email: "sem-vinculo@example.com",
                },
                comissoes: [{ parcela: 1, porcentagem: 1, valor: 1000 }],
              },
            ],
          },
        },
      ],
    };

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send(payload);
    expect(previewResponse.statusCode).toBe(200);

    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        ...payload,
        unitResolutions: [
          {
            key: previewResponse.body.unitGroups[0].key,
            companyId: fixture.company.id,
            unitId: fixture.unit.id,
          },
        ],
        responsibleResolutions: [
          {
            key: previewResponse.body.responsibleGroups[0].key,
            sellerId: fixture.seller.id,
          },
        ],
        commissionBeneficiaryResolutions: [],
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(0);
    expect(applyResponse.body.failedRows).toBe(1);
    expect(applyResponse.body.failures[0].message).toContain(
      "Selecione todos os comissionados",
    );
  });

  it("should mark JSON import preview rows invalid when status is unknown", async () => {
    const fixture = await createFixture();

    const response = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        parentProductId: fixture.productConsortiumParent.id,
        cotas: [
          {
            cota: 7001,
            data_pagamento: "2026-03-12",
            cliente: {
              nome: "Cliente Status Inválido",
              cpf_cnpj: "52998224725",
            },
            vendedor: {
              nome: fixture.seller.name,
              email: fixture.seller.email,
            },
            unidade: fixture.unit.name,
            status: "status alienígena",
            servico: "imovel",
            credito: 100_000,
          },
        ],
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.invalidRows).toBe(1);
    expect(response.body.rows[0].errors).toContain("Status desconhecido");
  });

  it("should prioritize sale situacao over legacy status in JSON import", async () => {
    const fixture = await createFixture();

    const previewResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        parentProductId: fixture.productConsortiumParent.id,
        cotas: [
          {
            contrato: "1041397615",
            cota: 1152,
            data_adesao: "2026-03-16",
            data_pagamento: "2026-03-30",
            cliente: {
              nome: "BERNARDO PEREIRA DA COSTA",
              cpf_cnpj: "06028450090",
            },
            vendedor: {
              nome: fixture.seller.name,
              email: fixture.seller.email,
            },
            unidade: fixture.unit.name,
            situacao: "Concluída",
            status: "Não contemplada",
            servico: "veiculo",
            credito: 100_000,
          },
        ],
      });

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.body.invalidRows).toBe(0);
    expect(previewResponse.body.rows[0].status).toBe("COMPLETED");

    const applyResponse = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/apply`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        parentProductId: fixture.productConsortiumParent.id,
        cotas: [
          {
            contrato: "1041397615",
            cota: 1152,
            data_adesao: "2026-03-16",
            data_pagamento: "2026-03-30",
            cliente: {
              nome: "BERNARDO PEREIRA DA COSTA",
              cpf_cnpj: "06028450090",
            },
            vendedor: {
              nome: fixture.seller.name,
              email: fixture.seller.email,
            },
            unidade: fixture.unit.name,
            situacao: "Concluída",
            status: "Não contemplada",
            servico: "veiculo",
            credito: 100_000,
          },
        ],
        unitResolutions: [
          {
            key: previewResponse.body.unitGroups[0].key,
            companyId: fixture.company.id,
            unitId: fixture.unit.id,
          },
        ],
        responsibleResolutions: [
          {
            key: previewResponse.body.responsibleGroups[0].key,
            sellerId: fixture.seller.id,
          },
        ],
        commissionBeneficiaryResolutions: [],
      });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.body.importedRows).toBe(1);

    const importedSale = await prisma.sale.findUnique({
      where: { id: applyResponse.body.createdSaleIds[0] },
      select: {
        status: true,
      },
    });

    expect(importedSale?.status).toBe("COMPLETED");
  });

  it("should accept JSON import preview payloads larger than Fastify default body limit", async () => {
    const fixture = await createFixture();

    const response = await request(app.server)
      .post(`/organizations/${fixture.org.slug}/sales/json-imports/preview`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({
        parentProductId: fixture.productConsortiumParent.id,
        cotas: [
          {
            cota: 8001,
            data_pagamento: "2026-03-12",
            cliente: {
              nome: "Cliente JSON Grande",
              cpf_cnpj: "52998224725",
            },
            vendedor: {
              nome: fixture.seller.name,
              email: fixture.seller.email,
            },
            unidade: fixture.unit.name,
            status: "Não confirmada",
            servico: "imovel",
            credito: 100_000,
            observacao_extensa: "x".repeat(1_100_000),
          },
        ],
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.validRows).toBe(1);
  });
});
