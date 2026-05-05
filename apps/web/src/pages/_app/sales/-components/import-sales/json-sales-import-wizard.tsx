import {
  AlertCircle,
  CheckCircle2,
  FileJson,
  Loader2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useApplySaleJsonImport,
  usePreviewSaleJsonImport,
  useSaleFormOptions,
} from "@/hooks/sales";
import { useGetOrganizationsSlugProductsIdSaleFields } from "@/http/generated";
import type {
  SaleJsonImportApplyBody,
  SaleJsonImportPayload,
  SaleJsonImportPreview,
  SaleJsonImportResult,
  SaleJsonImportSuggestedEntity,
} from "@/schemas/types/sale-import";
import { useApp } from "@/context/app-context";
import {
  buildSuggestedJsonDynamicFieldMappings,
  parseJsonSalesImportContent,
  type ParsedJsonSalesImportPayload,
} from "./json-sales-import-helpers";

const NONE_VALUE = "__NONE__";
const COMMISSION_RECIPIENT_TYPES = [
  "COMPANY",
  "UNIT",
  "SELLER",
  "PARTNER",
  "SUPERVISOR",
  "OTHER",
] as const;
const COMMISSION_SECTION_LABELS = {
  unidade: "Unidades",
  vendedor: "Vendedores",
  terceiros: "Terceiros",
} as const;

type CommissionRecipientType = (typeof COMMISSION_RECIPIENT_TYPES)[number];

type UnitResolutionDraft = {
  companyId: string;
  unitId?: string;
  responsibleType?: CommissionRecipientType;
  responsibleId?: string;
  responsibleLabel?: string;
};

type CommissionResolutionDraft = {
  recipientType: CommissionRecipientType;
  beneficiaryId: string;
  beneficiaryLabel?: string;
};

function formatGroupLabel(name: string | null, email?: string | null) {
  if (name && email) {
    return `${name} (${email})`;
  }

  return name ?? email ?? "Sem identificação";
}

export function JsonSalesImportWizard() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedPayload, setParsedPayload] =
    useState<ParsedJsonSalesImportPayload | null>(null);
  const [parentProductId, setParentProductId] = useState("");
  const [dynamicFieldMappings, setDynamicFieldMappings] = useState<
    Record<string, string>
  >({});
  const [preview, setPreview] = useState<SaleJsonImportPreview | null>(null);
  const [unitResolutions, setUnitResolutions] = useState<
    Record<string, UnitResolutionDraft>
  >({});
  const [commissionResolutions, setCommissionResolutions] = useState<
    Record<string, CommissionResolutionDraft>
  >({});
  const [result, setResult] = useState<SaleJsonImportResult | null>(null);

  const { organization } = useApp();
  const {
    companies,
    products,
    rootProducts,
    sellers,
    partners,
    supervisors,
    isLoading: isLoadingOptions,
  } = useSaleFormOptions();
  const previewMutation = usePreviewSaleJsonImport();
  const applyMutation = useApplySaleJsonImport();

  const saleFieldsQuery = useGetOrganizationsSlugProductsIdSaleFields(
    {
      slug: organization?.slug ?? "",
      id: parentProductId,
      params: { includeInherited: true },
    },
    {
      query: {
        enabled: Boolean(organization?.slug && parentProductId),
      },
    },
  );

  const productOptions = rootProducts.length > 0 ? rootProducts : products;
  const saleFields = useMemo(
    () => saleFieldsQuery.data?.fields ?? [],
    [saleFieldsQuery.data?.fields],
  );
  const unitOptions = useMemo(
    () =>
      companies.flatMap((company) =>
        (company.units ?? []).map((unit) => ({
          id: unit.id,
          companyId: company.id,
          label: `${company.name} -> ${unit.name}`,
        })),
      ),
    [companies],
  );
  const saleLocationOptions = useMemo(
    () => [
      ...companies.map((company) => ({
        value: `company:${company.id}`,
        companyId: company.id,
        unitId: undefined,
        label: company.name,
      })),
      ...unitOptions.map((unit) => ({
        value: `unit:${unit.id}`,
        companyId: unit.companyId,
        unitId: unit.id,
        label: unit.label,
      })),
    ],
    [companies, unitOptions],
  );
  const commissionOptionsByType = useMemo(
    () => ({
      COMPANY: companies.map((company) => ({
        id: company.id,
        label: company.name,
      })),
      UNIT: unitOptions,
      SELLER: sellers.map((seller) => ({
        id: seller.id,
        label: seller.name,
      })),
      PARTNER: partners.map((partner) => ({
        id: partner.id,
        label: partner.name,
      })),
      SUPERVISOR: supervisors.map((supervisor) => ({
        id: supervisor.id,
        label: supervisor.name,
      })),
      OTHER: [],
    }),
    [companies, partners, sellers, supervisors, unitOptions],
  );
  const saleResponsibleOptionsByType = useMemo(
    () => ({
      COMPANY: companies.map((company) => ({
        id: company.id,
        label: company.name,
      })),
      UNIT: unitOptions,
      SELLER: sellers.map((seller) => ({
        id: seller.id,
        label: seller.name,
      })),
      PARTNER: partners.map((partner) => ({
        id: partner.id,
        label: partner.name,
      })),
      SUPERVISOR: supervisors.map((supervisor) => ({
        id: supervisor.id,
        label: supervisor.name,
      })),
      OTHER: [],
    }),
    [companies, partners, sellers, supervisors, unitOptions],
  );
  const commissionGroupsBySection = useMemo(
    () =>
      (["unidade", "vendedor", "terceiros"] as const)
        .map((section) => ({
          section,
          label: COMMISSION_SECTION_LABELS[section],
          groups:
            preview?.commissionBeneficiaryGroups.filter(
              (group) => group.section === section,
            ) ?? [],
        }))
        .filter((section) => section.groups.length > 0),
    [preview],
  );

  useEffect(() => {
    if (!parsedPayload || saleFields.length === 0) {
      return;
    }

    setDynamicFieldMappings((current) =>
      buildSuggestedJsonDynamicFieldMappings({
        fields: saleFields,
        jsonKeys: parsedPayload.jsonKeys,
        currentMappings: current,
      }),
    );
  }, [parsedPayload, saleFields]);

  async function handleFileChange(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const nextPayload = parseJsonSalesImportContent(file.name, content);
      setParsedPayload(nextPayload);
      setPreview(null);
      setResult(null);
      toast.success("JSON carregado.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível ler o JSON.";
      toast.error(message);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function buildPayload(): SaleJsonImportPayload | null {
    if (!parsedPayload || !parentProductId) {
      return null;
    }

    return {
      parentProductId,
      cotas: parsedPayload.cotas,
      dynamicFieldMappings: Object.entries(dynamicFieldMappings)
        .filter(([, jsonKey]) => Boolean(jsonKey))
        .map(([fieldId, jsonKey]) => ({
          fieldId,
          jsonKey,
        })),
    };
  }

  function applyPreviewDefaults(nextPreview: SaleJsonImportPreview) {
    setUnitResolutions(
      Object.fromEntries(
        nextPreview.unitGroups.map((group) => {
          const suggestion = group.suggestions[0];
          return [
            group.key,
            {
              companyId: suggestion?.companyId ?? "",
              unitId: suggestion?.unitId,
            },
          ];
        }),
      ),
    );
    setCommissionResolutions(
      Object.fromEntries(
        nextPreview.commissionBeneficiaryGroups.map((group) => {
          const suggestion = group.suggestions.find((item) =>
            COMMISSION_RECIPIENT_TYPES.includes(
              item.type as CommissionRecipientType,
            ),
          ) as SaleJsonImportSuggestedEntity | undefined;

          return [
            group.key,
            {
              recipientType:
                (suggestion?.type as CommissionRecipientType | undefined) ??
                "SELLER",
              beneficiaryId: suggestion?.id ?? "",
              beneficiaryLabel:
                group.name ?? group.email ?? group.externalId ?? "",
            },
          ];
        }),
      ),
    );
  }

  async function handlePreview() {
    const payload = buildPayload();
    if (!payload) {
      toast.error("Selecione o arquivo JSON e o produto base.");
      return;
    }

    const nextPreview = await previewMutation.mutateAsync(payload);
    setPreview(nextPreview);
    setResult(null);
    applyPreviewDefaults(nextPreview);
  }

  function buildApplyPayload(): SaleJsonImportApplyBody | null {
    const payload = buildPayload();
    if (!payload || !preview) {
      return null;
    }

    return {
      ...payload,
      unitResolutions: preview.unitGroups
        .map((group) => ({
          key: group.key,
          companyId: unitResolutions[group.key]?.companyId ?? "",
          unitId: unitResolutions[group.key]?.unitId,
        }))
        .filter((resolution) => Boolean(resolution.companyId)),
      responsibleResolutions: preview.unitGroups.flatMap<
        SaleJsonImportApplyBody["responsibleResolutions"][number]
      >((group) => {
        const resolution = unitResolutions[group.key];
        if (!resolution?.responsibleType) {
          return [];
        }

        if (resolution.responsibleType === "OTHER") {
          if (!resolution.responsibleLabel) {
            return [];
          }

          return [
            {
              key: group.key,
              type: resolution.responsibleType,
              label: resolution.responsibleLabel,
            },
          ];
        }

        if (!resolution.responsibleId) {
          return [];
        }

        return [
          {
            key: group.key,
            type: resolution.responsibleType,
            id: resolution.responsibleId,
          },
        ];
      }),
      commissionBeneficiaryResolutions:
        preview.commissionBeneficiaryGroups.flatMap<
          SaleJsonImportApplyBody["commissionBeneficiaryResolutions"][number]
        >((group) => {
          const resolution = commissionResolutions[group.key];
          if (!resolution) {
            return [];
          }

          if (resolution.recipientType === "OTHER") {
            if (!resolution.beneficiaryLabel) {
              return [];
            }

            return [
              {
                key: group.key,
                recipientType: resolution.recipientType,
                beneficiaryLabel: resolution.beneficiaryLabel,
              },
            ];
          }

          if (!resolution.beneficiaryId) {
            return [];
          }

          return [
            {
              key: group.key,
              recipientType: resolution.recipientType,
              beneficiaryId: resolution.beneficiaryId,
            },
          ];
        }),
    };
  }

  function hasMissingResolutions() {
    if (!preview) {
      return true;
    }

    return (
      preview.unitGroups.some((group) => {
        const resolution = unitResolutions[group.key];
        if (!resolution?.companyId) {
          return true;
        }

        if (!resolution.responsibleType) {
          return false;
        }

        return resolution.responsibleType === "OTHER"
          ? !resolution.responsibleLabel
          : !resolution.responsibleId;
      }) ||
      preview.commissionBeneficiaryGroups.some((group) => {
        const resolution = commissionResolutions[group.key];
        if (!resolution) {
          return true;
        }

        return resolution.recipientType === "OTHER"
          ? !resolution.beneficiaryLabel
          : !resolution.beneficiaryId;
      })
    );
  }

  async function handleApply() {
    const payload = buildApplyPayload();
    if (!payload) {
      toast.error("Faça a pré-validação antes de importar.");
      return;
    }

    if (hasMissingResolutions()) {
      toast.error("Resolva todos os vínculos antes de importar.");
      return;
    }

    const nextResult = await applyMutation.mutateAsync(payload);
    setResult(nextResult);
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <Label>Arquivo JSON</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(event) => handleFileChange(event.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
              </Button>
            </div>
          </div>

          <div className="min-w-72 space-y-1">
            <Label>Produto base</Label>
            <Select
              value={parentProductId || NONE_VALUE}
              onValueChange={(value) => {
                setParentProductId(value === NONE_VALUE ? "" : value);
                setPreview(null);
                setResult(null);
              }}
              disabled={isLoadingOptions}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Selecionar...</SelectItem>
                {productOptions.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {parsedPayload ? (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">
              <FileJson className="size-3" />
              {parsedPayload.fileName}
            </Badge>
            <Badge variant="secondary">
              {parsedPayload.cotas.length} cotas
            </Badge>
          </div>
        ) : null}
      </Card>

      {parsedPayload && parentProductId ? (
        <Card className="space-y-4 p-4">
          <h3 className="font-semibold">Campos personalizados</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {saleFields.map((field) => (
              <div key={field.id} className="space-y-1">
                <Label>{field.label}</Label>
                <Select
                  value={dynamicFieldMappings[field.id] || NONE_VALUE}
                  onValueChange={(value) =>
                    setDynamicFieldMappings((current) => ({
                      ...current,
                      [field.id]: value === NONE_VALUE ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem mapeamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Sem mapeamento</SelectItem>
                    {parsedPayload.jsonKeys.map((key) => (
                      <SelectItem key={key} value={key}>
                        {key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handlePreview}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Pré-validar
            </Button>
          </div>
        </Card>
      ) : null}

      {preview ? (
        <>
          <Card className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <SummaryBadge label="Total" value={preview.totalRows} />
              <SummaryBadge label="Válidas" value={preview.validRows} />
              <SummaryBadge label="Inválidas" value={preview.invalidRows} />
              <SummaryBadge
                label="Comissionados"
                value={preview.commissionBeneficiaryGroups.length}
              />
            </div>
          </Card>

          {preview.invalidRows > 0 ? (
            <Card className="space-y-3 p-4">
              <h3 className="font-semibold">Linhas com atenção</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linha</TableHead>
                    <TableHead>Erros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows
                    .filter((row) => !row.isValid)
                    .slice(0, 20)
                    .map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>{row.errors.join("; ")}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>
          ) : null}

          <Card className="space-y-4 p-4">
            <h3 className="font-semibold">Empresa/unidade da venda</h3>
            <div className="grid gap-3">
              {preview.unitGroups.map((group) => {
                const resolution = unitResolutions[group.key];
                const selectedLocationValue = resolution?.unitId
                  ? `unit:${resolution.unitId}`
                  : resolution?.companyId
                    ? `company:${resolution.companyId}`
                    : NONE_VALUE;
                const selectedLocation = saleLocationOptions.find(
                  (option) => option.value === selectedLocationValue,
                );

                return (
                  <div key={group.key} className="rounded-md border p-3">
                    <div className="mb-3 flex flex-col gap-1">
                      <span className="text-sm font-medium">{group.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {selectedLocation?.unitId
                          ? `Unidade vinculada: ${selectedLocation.label}`
                          : selectedLocation
                            ? `Empresa vinculada: ${selectedLocation.label}`
                            : "Selecione a empresa ou unidade para esta venda"}
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_180px_1fr]">
                      <div className="space-y-1">
                        <Label>Empresa/unidade</Label>
                        <Select
                          value={selectedLocationValue}
                          onValueChange={(value) => {
                            const location = saleLocationOptions.find(
                              (option) => option.value === value,
                            );
                            setUnitResolutions((current) => ({
                              ...current,
                              [group.key]: {
                                ...current[group.key],
                                companyId: location?.companyId ?? "",
                                unitId: location?.unitId,
                              },
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione empresa/unidade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>
                              Selecionar...
                            </SelectItem>
                            {saleLocationOptions.map((location) => (
                              <SelectItem
                                key={location.value}
                                value={location.value}
                              >
                                {location.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label>Tipo do responsável</Label>
                        <Select
                          value={resolution?.responsibleType ?? NONE_VALUE}
                          onValueChange={(value) =>
                            setUnitResolutions((current) => ({
                              ...current,
                              [group.key]: {
                                ...current[group.key],
                                companyId: current[group.key]?.companyId ?? "",
                                unitId: current[group.key]?.unitId,
                                responsibleType:
                                  value === NONE_VALUE
                                    ? undefined
                                    : (value as CommissionRecipientType),
                                responsibleId: undefined,
                                responsibleLabel: undefined,
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sem responsável" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>
                              Sem responsável
                            </SelectItem>
                            <SelectItem value="COMPANY">Empresa</SelectItem>
                            <SelectItem value="UNIT">Unidade</SelectItem>
                            <SelectItem value="SELLER">Vendedor</SelectItem>
                            <SelectItem value="PARTNER">Parceiro</SelectItem>
                            <SelectItem value="SUPERVISOR">
                              Supervisor
                            </SelectItem>
                            <SelectItem value="OTHER">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label>Responsável</Label>
                        {resolution?.responsibleType === "OTHER" ? (
                          <Input
                            value={resolution?.responsibleLabel ?? ""}
                            onChange={(event) =>
                              setUnitResolutions((current) => ({
                                ...current,
                                [group.key]: {
                                  ...current[group.key],
                                  companyId:
                                    current[group.key]?.companyId ?? "",
                                  unitId: current[group.key]?.unitId,
                                  responsibleLabel: event.target.value,
                                },
                              }))
                            }
                            placeholder="Nome do responsável"
                          />
                        ) : (
                          <Select
                            value={resolution?.responsibleId ?? NONE_VALUE}
                            disabled={!resolution?.responsibleType}
                            onValueChange={(value) =>
                              setUnitResolutions((current) => ({
                                ...current,
                                [group.key]: {
                                  ...current[group.key],
                                  companyId:
                                    current[group.key]?.companyId ?? "",
                                  unitId: current[group.key]?.unitId,
                                  responsibleId:
                                    value === NONE_VALUE ? undefined : value,
                                },
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o responsável" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE_VALUE}>
                                Selecionar...
                              </SelectItem>
                              {(
                                saleResponsibleOptionsByType[
                                  resolution?.responsibleType ?? "SELLER"
                                ] ?? []
                              ).map((responsible) => (
                                <SelectItem
                                  key={responsible.id}
                                  value={responsible.id}
                                >
                                  {responsible.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {preview.commissionBeneficiaryGroups.length > 0 ? (
            <Card className="space-y-4 p-4">
              <h3 className="font-semibold">Comissionados</h3>
              <div className="grid gap-3">
                {commissionGroupsBySection.map((sectionGroup) => (
                  <div key={sectionGroup.section} className="space-y-2">
                    <h4 className="text-sm font-medium">
                      {sectionGroup.label}
                    </h4>
                    {sectionGroup.groups.map((group) => {
                      const currentResolution = commissionResolutions[
                        group.key
                      ] ?? {
                        recipientType: "SELLER" as CommissionRecipientType,
                        beneficiaryId: "",
                      };
                      const options =
                        commissionOptionsByType[
                          currentResolution.recipientType
                        ] ?? [];

                      return (
                        <div
                          key={group.key}
                          className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_180px_1fr]"
                        >
                          <div className="space-y-1">
                            <Label>
                              {formatGroupLabel(group.name, group.email)}
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">
                                {sectionGroup.label}
                              </Badge>
                              {group.externalType ? (
                                <Badge variant="secondary">
                                  {group.externalType}
                                </Badge>
                              ) : null}
                            </div>
                          </div>

                          <Select
                            value={currentResolution.recipientType}
                            onValueChange={(value) =>
                              setCommissionResolutions((current) => ({
                                ...current,
                                [group.key]: {
                                  recipientType:
                                    value as CommissionRecipientType,
                                  beneficiaryId: "",
                                  beneficiaryLabel:
                                    value === "OTHER"
                                      ? (group.name ??
                                        group.email ??
                                        group.externalId ??
                                        "")
                                      : undefined,
                                },
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="COMPANY">Empresa</SelectItem>
                              <SelectItem value="UNIT">Unidade</SelectItem>
                              <SelectItem value="SELLER">Vendedor</SelectItem>
                              <SelectItem value="PARTNER">Parceiro</SelectItem>
                              <SelectItem value="SUPERVISOR">
                                Supervisor
                              </SelectItem>
                              <SelectItem value="OTHER">Outro</SelectItem>
                            </SelectContent>
                          </Select>

                          {currentResolution.recipientType === "OTHER" ? (
                            <Input
                              value={currentResolution.beneficiaryLabel ?? ""}
                              onChange={(event) =>
                                setCommissionResolutions((current) => ({
                                  ...current,
                                  [group.key]: {
                                    ...currentResolution,
                                    beneficiaryLabel: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Nome do comissionado"
                            />
                          ) : (
                            <Select
                              value={
                                currentResolution.beneficiaryId || NONE_VALUE
                              }
                              onValueChange={(value) =>
                                setCommissionResolutions((current) => ({
                                  ...current,
                                  [group.key]: {
                                    ...currentResolution,
                                    beneficiaryId:
                                      value === NONE_VALUE ? "" : value,
                                  },
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o vínculo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE_VALUE}>
                                  Selecionar...
                                </SelectItem>
                                {options.map((option) => (
                                  <SelectItem key={option.id} value={option.id}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleApply}
              disabled={applyMutation.isPending || hasMissingResolutions()}
            >
              {applyMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Importar JSON
            </Button>
          </div>
        </>
      ) : null}

      {result ? (
        <Card className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            {result.failedRows > 0 ? (
              <AlertCircle className="size-5 text-amber-600" />
            ) : (
              <CheckCircle2 className="size-5 text-emerald-600" />
            )}
            <h3 className="font-semibold">Resultado</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <SummaryBadge label="Total" value={result.totalRows} />
            <SummaryBadge label="Importadas" value={result.importedRows} />
            <SummaryBadge label="Falhas" value={result.failedRows} />
          </div>
          {result.failures.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.failures.map((failure) => (
                  <TableRow key={`${failure.rowNumber}-${failure.message}`}>
                    <TableCell>{failure.rowNumber}</TableCell>
                    <TableCell>{failure.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function SummaryBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold text-lg">{value}</div>
    </div>
  );
}
