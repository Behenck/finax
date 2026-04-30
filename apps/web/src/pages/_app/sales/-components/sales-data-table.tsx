import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CardSectionSkeleton } from "@/components/loading-skeletons";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { format, parse, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowUpDown,
  Copy,
  EllipsisVertical,
  Eye,
  ListFilter,
  ListTree,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FilterPanel } from "@/components/filter-panel";
import { ResponsiveDataView } from "@/components/responsive-data-view";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApp } from "@/context/app-context";
import {
  dateFilterParser,
  entityFilterParser,
  pageParser,
  textFilterParser,
} from "@/hooks/filters/parsers";
import {
  useDeleteSale,
  useDeleteSalesBulk,
  usePatchSalesStatusBulk,
} from "@/hooks/sales";
import { persistSaleNavigationContext } from "@/hooks/sales/use-sale-navigation";
import { useCheckboxMultiSelect } from "@/hooks/use-checkbox-multi-select";
import {
  type GetOrganizationsSlugSales200,
  type GetOrganizationsSlugSalesSaleid200,
  getOrganizationsSlugSalesSaleidQueryOptions,
  useGetOrganizationsSlugCompanies,
  useGetOrganizationsSlugProducts,
} from "@/http/generated";
import { useAbility } from "@/permissions/access";
import type {
  SaleDynamicFieldOption,
  SaleDynamicFieldType,
} from "@/schemas/types/sale-dynamic-fields";
import {
  SALE_RESPONSIBLE_TYPE_LABEL,
  SALE_STATUS_LABEL,
  SALE_STATUS_TRANSITIONS,
  type SaleResponsibleType,
  type SaleStatus,
  SaleStatusSchema,
} from "@/schemas/types/sales";
import { formatCurrencyBRL } from "@/utils/format-amount";
import { formatSaleDynamicFieldValue } from "./sale-dynamic-fields";
import { SaleInstallmentsDrawer } from "./sale-installments-drawer";
import { SaleDelinquencyBadge } from "./sale-delinquency-badge";
import { SalePreCancellationBadge } from "./sale-pre-cancellation-badge";
import { SaleStatusAction } from "./sale-status-action";
import { SaleStatusBadge } from "./sale-status-badge";

type SaleRow = GetOrganizationsSlugSales200["sales"][number];
type SaleDetailRow = GetOrganizationsSlugSalesSaleid200["sale"];
type SaleTableRow = SaleRow & {
  productLabel: string;
};

type SaleDynamicFieldColumn = {
  columnId: string;
  label: string;
  labelNormalized: string;
  type: SaleDynamicFieldType;
  options: SaleDynamicFieldOption[];
};

type ProductTreeNode = {
  id: string;
  name: string;
  children?: ProductTreeNode[];
};

const SALE_STATUS_FILTER_VALUES = [
  "ALL",
  "PENDING",
  "APPROVED",
  "COMPLETED",
  "CANCELED",
] as const;
const SALE_RESPONSIBLE_TYPE_FILTER_VALUES = [
  "ALL",
  "COMPANY",
  "UNIT",
  "SELLER",
  "PARTNER",
  "SUPERVISOR",
  "OTHER",
] as const;

type SaleStatusFilter = (typeof SALE_STATUS_FILTER_VALUES)[number];
type SaleResponsibleTypeFilter =
  (typeof SALE_RESPONSIBLE_TYPE_FILTER_VALUES)[number];

type ResponsibleFilterOption = {
  id: string;
  name: string;
};

const SALE_STATUS_SORT_PRIORITY: Record<SaleStatus, number> = {
  PENDING: 0,
  APPROVED: 1,
  COMPLETED: 2,
  CANCELED: 3,
};

const saleStatusFilterParser = parseAsStringLiteral(SALE_STATUS_FILTER_VALUES)
  .withDefault("ALL")
  .withOptions({ history: "replace" });
const saleResponsibleTypeFilterParser = parseAsStringLiteral(
  SALE_RESPONSIBLE_TYPE_FILTER_VALUES,
)
  .withDefault("ALL")
  .withOptions({ history: "replace" });

const SALES_FILTERS_STORAGE_KEY = "finax:sales:list:filters";
const SALES_COLUMNS_STORAGE_KEY = "finax:sales:list:columns";
const SALE_DYNAMIC_FIELD_COLUMN_PREFIX = "dynamicField:";
const SALES_PAGE_SIZE = 10;

function getSaleDynamicFieldColumnId(fieldId: string) {
  return `${SALE_DYNAMIC_FIELD_COLUMN_PREFIX}${encodeURIComponent(fieldId)}`;
}

function normalizeDynamicFieldLabel(label: string) {
  return label.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function getColumnVisibilityLabel(
  columnId: string,
  dynamicFieldLabelByColumnId: Map<string, string>,
) {
  const dynamicFieldLabel = dynamicFieldLabelByColumnId.get(columnId);
  if (dynamicFieldLabel) {
    return dynamicFieldLabel;
  }

  if (columnId === "saleDate") {
    return "data";
  }

  if (columnId === "customer") {
    return "cliente";
  }

  if (columnId === "productLabel") {
    return "produto";
  }

  if (columnId === "companyUnit") {
    return "empresa/unidade";
  }

  if (columnId === "responsible") {
    return "responsável";
  }

  if (columnId === "totalAmount") {
    return "valor";
  }

  if (columnId === "commissionInstallments") {
    return "parcelas";
  }

  if (columnId === "status") {
    return "status";
  }

  return "atualização";
}

function readStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
      return fallback;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function formatSaleDate(value: string) {
  const dateOnly = value.slice(0, 10);
  const parsedDate = parse(dateOnly, "yyyy-MM-dd", new Date());
  return format(parsedDate, "dd/MM/yyyy");
}

function formatDateTime(value: string) {
  return format(parseISO(value), "dd/MM/yyyy HH:mm");
}

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function splitProductHierarchyLabel(productLabel: string) {
  const parts = productLabel
    .split("->")
    .map((part) => part.trim())
    .filter(Boolean);
  const parentLabel = parts[0] ?? productLabel;
  const childPathLabel = parts.slice(1).join(" -> ");

  return {
    parentLabel,
    childPathLabel,
  };
}

function buildProductPathMap(
  nodes: ProductTreeNode[],
  parentPath: string[] = [],
  map = new Map<string, string>(),
) {
  for (const node of nodes) {
    const currentPath = [...parentPath, node.name];
    map.set(node.id, currentPath.join(" -> "));

    const children = Array.isArray(node.children) ? node.children : [];
    buildProductPathMap(children, currentPath, map);
  }

  return map;
}

function resolveSaleDynamicFieldDisplayValue(
  saleDetail: SaleDetailRow,
  field: SaleDynamicFieldColumn,
) {
  const matchedField = saleDetail.dynamicFieldSchema.find(
    (schemaField) =>
      normalizeDynamicFieldLabel(schemaField.label) === field.labelNormalized,
  );
  const fieldId = matchedField?.fieldId;
  if (!fieldId) {
    return "vazio";
  }

  const value = Object.hasOwn(saleDetail.dynamicFieldValues, fieldId)
    ? saleDetail.dynamicFieldValues[fieldId]
    : null;

  return formatSaleDynamicFieldValue(
    {
      type: (matchedField?.type as SaleDynamicFieldType) ?? field.type,
      options: matchedField?.options ?? field.options,
    },
    value,
  );
}

interface SalesDataTableProps {
  sales: SaleRow[];
  isLoading: boolean;
  isError: boolean;
  showFilters: boolean;
  onRetry: () => void;
}

interface SaleTableRowActionsProps {
  sale: SaleTableRow;
  onOpenInstallments(sale: SaleTableRow): void;
  onNavigateSale(): void;
}

function SaleTableRowActions({
  sale,
  onOpenInstallments,
  onNavigateSale,
}: SaleTableRowActionsProps) {
  const ability = useAbility();
  const canViewAllCommissions = ability.can(
    "access",
    "sales.commissions.view.all",
  );
  const canCreateSale = ability.can("access", "sales.create");
  const canUpdateSale = ability.can("access", "sales.update");
  const canEditSale =
    canUpdateSale || (canCreateSale && sale.status === "PENDING");
  const canDuplicateSale = canCreateSale;
  const canChangeSaleStatus = ability.can("access", "sales.status.change");
  const canDeleteSalePermission = ability.can("access", "sales.delete");
  const canManageCommissions = ability.can(
    "access",
    "sales.commissions.manage",
  );
  const canChangeCommissionInstallmentStatus = ability.can(
    "access",
    "sales.commissions.installments.status.change",
  );
  const canUpdateCommissionInstallment = ability.can(
    "access",
    "sales.commissions.installments.update",
  );
  const canDeleteCommissionInstallment = ability.can(
    "access",
    "sales.commissions.installments.delete",
  );
  const canAccessCommissionInstallments =
    canViewAllCommissions &&
    (canManageCommissions ||
      canChangeCommissionInstallmentStatus ||
      canUpdateCommissionInstallment ||
      canDeleteCommissionInstallment);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { mutateAsync: deleteSale, isPending } = useDeleteSale();

  async function handleConfirmDelete() {
    try {
      await deleteSale({
        saleId: sale.id,
      });
      setDeleteDialogOpen(false);
    } catch {
      // erro tratado no hook
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isPending}>
            <EllipsisVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              to="/sales/$saleId"
              params={{ saleId: sale.id }}
              onClick={onNavigateSale}
            >
              <Eye className="size-4" />
              Ver detalhes
            </Link>
          </DropdownMenuItem>
          {canEditSale ? (
            <DropdownMenuItem asChild>
              <Link
                to="/sales/update/$saleId"
                params={{ saleId: sale.id }}
                onClick={onNavigateSale}
              >
                <Pencil className="size-4" />
                Editar
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canDuplicateSale ? (
            <DropdownMenuItem asChild>
              <Link
                to="/sales/create"
                search={{
                  duplicateSaleId: sale.id,
                }}
              >
                <Copy className="size-4" />
                Duplicar
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canAccessCommissionInstallments ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onOpenInstallments(sale);
              }}
            >
              <ListTree className="size-4" />
              Ver parcelas
            </DropdownMenuItem>
          ) : null}
          {canChangeSaleStatus ? (
            <>
              <DropdownMenuSeparator />
              <SaleStatusAction
                saleId={sale.id}
                currentStatus={sale.status as SaleStatus}
                trigger="dropdown-item"
              />
            </>
          ) : null}
          {canDeleteSalePermission ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={isPending}
                onSelect={(event) => {
                  event.preventDefault();
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="size-4" />
                Excluir
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a venda do cliente{" "}
              <strong>{sale.customer.name}</strong>? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isPending}
            >
              {isPending ? "Excluindo..." : "Excluir venda"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function SalesDataTable({
  sales,
  isLoading,
  isError,
  showFilters,
  onRetry,
}: SalesDataTableProps) {
  const ability = useAbility();
  const canViewAllCommissions = ability.can(
    "access",
    "sales.commissions.view.all",
  );
  const canCreateSale = ability.can("access", "sales.create");
  const canUpdateSale = ability.can("access", "sales.update");
  const canChangeSaleStatus = ability.can("access", "sales.status.change");
  const canDeleteSale = ability.can("access", "sales.delete");
  const canManageCommissions = ability.can(
    "access",
    "sales.commissions.manage",
  );
  const canChangeCommissionInstallmentStatus = ability.can(
    "access",
    "sales.commissions.installments.status.change",
  );
  const canUpdateCommissionInstallment = ability.can(
    "access",
    "sales.commissions.installments.update",
  );
  const canDeleteCommissionInstallment = ability.can(
    "access",
    "sales.commissions.installments.delete",
  );
  const canAccessCommissionInstallments =
    canViewAllCommissions &&
    (canManageCommissions ||
      canChangeCommissionInstallmentStatus ||
      canUpdateCommissionInstallment ||
      canDeleteCommissionInstallment);
  const canUseBulkActions = canChangeSaleStatus || canDeleteSale;
  const { organization } = useApp();
  const slug = organization?.slug ?? "";
  const preCancellationDelinquencyThreshold =
    organization?.preCancellationDelinquencyThreshold ?? null;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => readStorageJson<VisibilityState>(SALES_COLUMNS_STORAGE_KEY, {}),
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkStatus, setBulkStatus] = useState<SaleStatus | "">("");
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const restoredFiltersRef = useRef(false);
  const saleNavigationOrderedIdsRef = useRef<string[]>([]);
  const saleCheckboxClickHandlerRef = useRef<
    (saleId: string, event: ReactMouseEvent<HTMLElement>) => void
  >(() => {});
  const saleCheckboxCheckedChangeHandlerRef = useRef<
    (saleId: string, checked: boolean) => void
  >(() => {});
  const [globalFilter, setGlobalFilter] = useQueryState("q", textFilterParser);
  const [companyIdFilter, setCompanyIdFilter] = useQueryState(
    "companyId",
    entityFilterParser,
  );
  const [unitIdFilter, setUnitIdFilter] = useQueryState(
    "unitId",
    entityFilterParser,
  );
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    saleStatusFilterParser,
  );
  const [responsibleTypeFilter, setResponsibleTypeFilter] = useQueryState(
    "responsibleType",
    saleResponsibleTypeFilterParser,
  );
  const [responsibleIdFilter, setResponsibleIdFilter] = useQueryState(
    "responsibleId",
    entityFilterParser,
  );
  const [saleDateFromFilter, setSaleDateFromFilter] = useQueryState(
    "saleDateFrom",
    dateFilterParser,
  );
  const [saleDateToFilter, setSaleDateToFilter] = useQueryState(
    "saleDateTo",
    dateFilterParser,
  );
  const [page, setPage] = useQueryState("page", pageParser);
  const { mutateAsync: patchSalesStatusBulk, isPending: isBulkStatusPending } =
    usePatchSalesStatusBulk();
  const { mutateAsync: deleteSalesBulk, isPending: isBulkDeletePending } =
    useDeleteSalesBulk();
  const columnFilters = useMemo<ColumnFiltersState>(
    () =>
      statusFilter === "ALL" ? [] : [{ id: "status", value: statusFilter }],
    [statusFilter],
  );
  const [installmentsDrawerSale, setInstallmentsDrawerSale] =
    useState<SaleTableRow | null>(null);
  const handlePersistSaleNavigationContext = useCallback(() => {
    persistSaleNavigationContext(saleNavigationOrderedIdsRef.current);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      SALES_COLUMNS_STORAGE_KEY,
      JSON.stringify(columnVisibility),
    );
  }, [columnVisibility]);

  useEffect(() => {
    if (!canViewAllCommissions) {
      return;
    }

    setColumnVisibility((currentValue) => {
      if ("commissionInstallments" in currentValue) {
        return currentValue;
      }

      return {
        ...currentValue,
        commissionInstallments: true,
      };
    });
  }, [canViewAllCommissions]);

  useEffect(() => {
    if (restoredFiltersRef.current) {
      return;
    }

    restoredFiltersRef.current = true;
    const storedFilters = readStorageJson<{
      q?: string;
      status?: SaleStatusFilter;
      companyId?: string;
      unitId?: string;
      responsibleType?: SaleResponsibleTypeFilter;
      responsibleId?: string;
      saleDateFrom?: string;
      saleDateTo?: string;
      page?: number;
    }>(SALES_FILTERS_STORAGE_KEY, {});

    if (!globalFilter && storedFilters.q) {
      void setGlobalFilter(storedFilters.q);
    }

    if (
      statusFilter === "ALL" &&
      storedFilters.status &&
      storedFilters.status !== "ALL"
    ) {
      void setStatusFilter(storedFilters.status);
    }

    if (!companyIdFilter && storedFilters.companyId) {
      void setCompanyIdFilter(storedFilters.companyId);
    }

    if (!unitIdFilter && storedFilters.unitId) {
      void setUnitIdFilter(storedFilters.unitId);
    }

    if (
      responsibleTypeFilter === "ALL" &&
      storedFilters.responsibleType &&
      storedFilters.responsibleType !== "ALL"
    ) {
      void setResponsibleTypeFilter(storedFilters.responsibleType);
    }

    if (
      !responsibleIdFilter &&
      storedFilters.responsibleId &&
      storedFilters.responsibleType &&
      storedFilters.responsibleType !== "ALL"
    ) {
      void setResponsibleIdFilter(storedFilters.responsibleId);
    }

    if (!saleDateFromFilter && storedFilters.saleDateFrom) {
      void setSaleDateFromFilter(storedFilters.saleDateFrom);
    }

    if (!saleDateToFilter && storedFilters.saleDateTo) {
      void setSaleDateToFilter(storedFilters.saleDateTo);
    }

    if (page === 1 && storedFilters.page && storedFilters.page > 1) {
      void setPage(storedFilters.page);
    }
  }, [
    companyIdFilter,
    globalFilter,
    page,
    setCompanyIdFilter,
    setGlobalFilter,
    setPage,
    setResponsibleIdFilter,
    setResponsibleTypeFilter,
    setStatusFilter,
    setUnitIdFilter,
    responsibleIdFilter,
    responsibleTypeFilter,
    saleDateFromFilter,
    saleDateToFilter,
    statusFilter,
    unitIdFilter,
    setSaleDateFromFilter,
    setSaleDateToFilter,
  ]);

  const currentPage = page >= 1 ? page : 1;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      SALES_FILTERS_STORAGE_KEY,
      JSON.stringify({
        q: globalFilter,
        status: statusFilter,
        companyId: companyIdFilter,
        unitId: unitIdFilter,
        responsibleType: responsibleTypeFilter,
        responsibleId: responsibleIdFilter,
        saleDateFrom: saleDateFromFilter,
        saleDateTo: saleDateToFilter,
        page: currentPage,
      }),
    );
  }, [
    companyIdFilter,
    currentPage,
    globalFilter,
    responsibleIdFilter,
    responsibleTypeFilter,
    saleDateFromFilter,
    saleDateToFilter,
    statusFilter,
    unitIdFilter,
  ]);
  const productsQuery = useGetOrganizationsSlugProducts(
    { slug },
    {
      query: {
        enabled: Boolean(organization?.slug),
      },
    },
  );
  const companiesQuery = useGetOrganizationsSlugCompanies(
    { slug },
    {
      query: {
        enabled: Boolean(organization?.slug),
      },
    },
  );
  const companies = useMemo(
    () => companiesQuery.data?.companies ?? [],
    [companiesQuery.data?.companies],
  );
  const unitsBySelectedCompany = useMemo(() => {
    if (!companyIdFilter) {
      return [];
    }

    return (
      companies.find((company) => company.id === companyIdFilter)?.units ?? []
    );
  }, [companies, companyIdFilter]);

  useEffect(() => {
    if (!unitIdFilter || !companyIdFilter) {
      return;
    }

    const unitExistsInSelectedCompany = unitsBySelectedCompany.some(
      (unit) => unit.id === unitIdFilter,
    );
    if (!unitExistsInSelectedCompany) {
      void setUnitIdFilter("");
      void setPage(1);
    }
  }, [
    companyIdFilter,
    setPage,
    setUnitIdFilter,
    unitIdFilter,
    unitsBySelectedCompany,
  ]);
  const responsibleOptionsByType = useMemo(() => {
    const optionsMap = new Map<string, string>();

    for (const sale of sales) {
      if (
        responsibleTypeFilter === "ALL" ||
        sale.responsible?.type !== responsibleTypeFilter ||
        !sale.responsible.id
      ) {
        continue;
      }

      optionsMap.set(sale.responsible.id, sale.responsible.name);
    }

    return Array.from(optionsMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((optionA, optionB) =>
        optionA.name.localeCompare(optionB.name, "pt-BR"),
      );
  }, [responsibleTypeFilter, sales]);
  const responsibleOptions = responsibleOptionsByType;

  useEffect(() => {
    if (responsibleTypeFilter === "ALL") {
      if (!responsibleIdFilter) {
        return;
      }

      void setResponsibleIdFilter("");
      void setPage(1);
      return;
    }

    if (!responsibleIdFilter) {
      return;
    }

    const responsibleExists = responsibleOptions.some(
      (responsibleOption) => responsibleOption.id === responsibleIdFilter,
    );
    if (!responsibleExists) {
      void setResponsibleIdFilter("");
      void setPage(1);
    }
  }, [
    responsibleIdFilter,
    responsibleOptions,
    responsibleTypeFilter,
    setPage,
    setResponsibleIdFilter,
  ]);

  const productPathById = useMemo(
    () =>
      buildProductPathMap(
        (productsQuery.data?.products ?? []) as ProductTreeNode[],
      ),
    [productsQuery.data?.products],
  );
  const filteredSales = useMemo(
    () =>
      sales.filter((sale) => {
        const saleDate = sale.saleDate.slice(0, 10);
        const matchesCompany =
          !companyIdFilter || sale.company.id === companyIdFilter;
        const matchesUnit = !unitIdFilter || sale.unit?.id === unitIdFilter;
        const matchesResponsibleType =
          responsibleTypeFilter === "ALL"
            ? true
            : sale.responsible?.type === responsibleTypeFilter;
        const matchesResponsibleId =
          !responsibleIdFilter || sale.responsible?.id === responsibleIdFilter;
        const matchesSaleDateFrom =
          !saleDateFromFilter || saleDate >= saleDateFromFilter;
        const matchesSaleDateTo =
          !saleDateToFilter || saleDate <= saleDateToFilter;

        return (
          matchesCompany &&
          matchesUnit &&
          matchesResponsibleType &&
          matchesResponsibleId &&
          matchesSaleDateFrom &&
          matchesSaleDateTo
        );
      }),
    [
      companyIdFilter,
      responsibleIdFilter,
      responsibleTypeFilter,
      saleDateFromFilter,
      saleDateToFilter,
      sales,
      unitIdFilter,
    ],
  );
  const tableData = useMemo<SaleTableRow[]>(
    () =>
      filteredSales
        .map((sale) => ({
          ...sale,
          productLabel:
            productPathById.get(sale.product.id) ?? sale.product.name,
        }))
        .sort((saleA, saleB) => {
          const statusDiff =
            (SALE_STATUS_SORT_PRIORITY[saleA.status as SaleStatus] ??
              Number.MAX_SAFE_INTEGER) -
            (SALE_STATUS_SORT_PRIORITY[saleB.status as SaleStatus] ??
              Number.MAX_SAFE_INTEGER);

          if (statusDiff !== 0) {
            return statusDiff;
          }

          return saleB.createdAt.localeCompare(saleA.createdAt);
        }),
    [filteredSales, productPathById],
  );
  const saleDetailQueries = useQueries({
    queries: tableData.map((sale) => ({
      ...getOrganizationsSlugSalesSaleidQueryOptions({
        slug,
        saleId: sale.id,
      }),
      staleTime: 60_000,
    })),
  });
  const saleDetailsBySaleId = useMemo(() => {
    return new Map(
      tableData.map((sale, index) => [
        sale.id,
        saleDetailQueries[index]?.data?.sale ?? null,
      ]),
    );
  }, [saleDetailQueries, tableData]);
  const dynamicFieldColumns = useMemo<SaleDynamicFieldColumn[]>(() => {
    const columnsByLabel = new Map<string, SaleDynamicFieldColumn>();

    for (const query of saleDetailQueries) {
      const saleDetail = query.data?.sale;
      if (!saleDetail) {
        continue;
      }

      for (const field of saleDetail.dynamicFieldSchema) {
        const labelNormalized = normalizeDynamicFieldLabel(field.label);
        if (!labelNormalized || columnsByLabel.has(labelNormalized)) {
          continue;
        }

        columnsByLabel.set(labelNormalized, {
          columnId: getSaleDynamicFieldColumnId(labelNormalized),
          label: field.label,
          labelNormalized,
          type: field.type as SaleDynamicFieldType,
          options: field.options,
        });
      }
    }

    return Array.from(columnsByLabel.values()).sort((columnA, columnB) =>
      columnA.label.localeCompare(columnB.label, "pt-BR"),
    );
  }, [saleDetailQueries]);
  const visibleDynamicFieldColumns = useMemo(
    () =>
      dynamicFieldColumns.filter(
        (field) => columnVisibility[field.columnId] === true,
      ),
    [columnVisibility, dynamicFieldColumns],
  );
  const dynamicFieldLabelByColumnId = useMemo(
    () =>
      new Map(
        dynamicFieldColumns.map((field) => [field.columnId, field.label]),
      ),
    [dynamicFieldColumns],
  );
  const dynamicFieldColumnsReady = useMemo(
    () =>
      dynamicFieldColumns.filter((field) => field.columnId in columnVisibility),
    [columnVisibility, dynamicFieldColumns],
  );
  const searchableVisibleDynamicContentBySaleId = useMemo(() => {
    const contentBySaleId = new Map<string, string>();
    if (visibleDynamicFieldColumns.length === 0) {
      return contentBySaleId;
    }

    for (const sale of tableData) {
      const saleDetail = saleDetailsBySaleId.get(sale.id);
      if (!saleDetail) {
        continue;
      }

      const searchableContent = visibleDynamicFieldColumns
        .map((field) => resolveSaleDynamicFieldDisplayValue(saleDetail, field))
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchableContent) {
        continue;
      }

      contentBySaleId.set(sale.id, searchableContent);
    }

    return contentBySaleId;
  }, [saleDetailsBySaleId, tableData, visibleDynamicFieldColumns]);

  useEffect(() => {
    if (dynamicFieldColumns.length === 0) {
      return;
    }

    setColumnVisibility((currentValue) => {
      let hasChanges = false;
      const nextValue: VisibilityState = { ...currentValue };

      for (const field of dynamicFieldColumns) {
        const columnId = field.columnId;
        if (columnId in nextValue) {
          continue;
        }

        nextValue[columnId] = false;
        hasChanges = true;
      }

      return hasChanges ? nextValue : currentValue;
    });
  }, [dynamicFieldColumns]);
  const salesGlobalFilterFn = useMemo<FilterFn<SaleTableRow>>(
    () => (row, _columnId, filterValue) => {
      const term = String(filterValue ?? "")
        .trim()
        .toLowerCase();
      if (!term) {
        return true;
      }

      const baseSearchableContent = [
        row.original.customer.name,
        row.original.productLabel,
        row.original.company.name,
        row.original.unit?.name,
        row.original.responsible?.name,
        row.original.notes,
        SALE_STATUS_LABEL[row.original.status as SaleStatus],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const dynamicSearchableContent =
        searchableVisibleDynamicContentBySaleId.get(row.original.id) ?? "";

      return `${baseSearchableContent} ${dynamicSearchableContent}`.includes(
        term,
      );
    },
    [searchableVisibleDynamicContentBySaleId],
  );

  const columns = useMemo<ColumnDef<SaleTableRow>[]>(
    () => [
      {
        id: "select",
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={
              canUseBulkActions
                ? table.getIsAllPageRowsSelected()
                  ? true
                  : table.getIsSomePageRowsSelected()
                    ? "indeterminate"
                    : false
                : false
            }
            onCheckedChange={(value) => {
              if (!canUseBulkActions) {
                return;
              }
              table.toggleAllPageRowsSelected(Boolean(value));
            }}
            disabled={!canUseBulkActions}
            aria-label="Selecionar página atual"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onClick={(event) =>
              saleCheckboxClickHandlerRef.current(row.original.id, event)
            }
            onCheckedChange={(value) =>
              saleCheckboxCheckedChangeHandlerRef.current(
                row.original.id,
                Boolean(value),
              )
            }
            disabled={!canUseBulkActions}
            aria-label={`Selecionar venda ${row.original.id}`}
          />
        ),
      },
      {
        accessorKey: "saleDate",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Data
            <ArrowUpDown className="ml-2 size-4" />
          </Button>
        ),
        cell: ({ row }) => formatSaleDate(row.original.saleDate),
      },
      {
        accessorKey: "customer",
        header: "Cliente",
        cell: ({ row }) => (
          <div className="max-w-[220px]">
            <span className="block truncate" title={row.original.customer.name}>
              {row.original.customer.name}
            </span>
            <SaleDelinquencyBadge
              summary={row.original.delinquencySummary}
              className="mt-1"
            />
          </div>
        ),
      },
      {
        accessorKey: "productLabel",
        header: "Produto",
        cell: ({ row }) => {
          const { parentLabel, childPathLabel } = splitProductHierarchyLabel(
            row.original.productLabel,
          );

          return (
            <div className="flex max-w-[220px] flex-col">
              <span className="truncate font-medium" title={parentLabel}>
                {parentLabel}
              </span>
              {childPathLabel ? (
                <span
                  className="truncate text-xs text-muted-foreground"
                  title={childPathLabel}
                >
                  {childPathLabel}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "companyUnit",
        header: "Empresa/Unidade",
        cell: ({ row }) => (
          <div className="flex max-w-[220px] flex-col">
            <span className="truncate" title={row.original.company.name}>
              {row.original.company.name}
            </span>
            <span
              className="truncate text-xs text-muted-foreground"
              title={row.original.unit?.name ?? "Sem unidade"}
            >
              {row.original.unit?.name ?? "Sem unidade"}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "responsible",
        header: "Responsável",
        cell: ({ row }) => (
          <div className="flex max-w-[180px] flex-col">
            <span
              className="truncate"
              title={row.original.responsible?.name ?? "Não informado"}
            >
              {row.original.responsible?.name ?? "Não informado"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {row.original.responsible
                ? row.original.responsible.type === "SELLER"
                  ? "Vendedor"
                  : "Parceiro"
                : "Sem vínculo"}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Valor
            <ArrowUpDown className="ml-2 size-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span
            className={
              row.original.totalAmount === 0
                ? "font-semibold text-muted-foreground"
                : "font-semibold"
            }
          >
            {formatCurrencyBRL(row.original.totalAmount / 100)}
          </span>
        ),
      },
      ...(canViewAllCommissions
        ? ([
            {
              id: "commissionInstallments",
              enableHiding: true,
              header: "Parcelas",
              cell: ({ row }) => {
                const summary = row.original.commissionInstallmentsSummary;
                if (!canAccessCommissionInstallments) {
                  return (
                    <span className="text-sm text-muted-foreground">
                      {summary.total === 0
                        ? "Sem parcelas"
                        : `${summary.paid}/${summary.total} pagas`}
                    </span>
                  );
                }
                return (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto px-2 py-1 justify-start"
                    onClick={() => setInstallmentsDrawerSale(row.original)}
                  >
                    {summary.total === 0
                      ? "Sem parcelas"
                      : `${summary.paid}/${summary.total} pagas`}
                  </Button>
                );
              },
            },
          ] as ColumnDef<SaleTableRow>[])
        : []),
      {
        accessorKey: "status",
        header: "Status",
        filterFn: (row, columnId, value) => {
          if (!value) {
            return true;
          }

          return row.getValue(columnId) === value;
        },
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <SaleStatusBadge status={row.original.status as SaleStatus} />
            <SalePreCancellationBadge
              threshold={preCancellationDelinquencyThreshold}
              summary={row.original.delinquencySummary}
            />
          </div>
        ),
      },
      ...dynamicFieldColumnsReady.map<ColumnDef<SaleTableRow>>((field) => ({
        id: field.columnId,
        header: field.label,
        cell: ({ row }) => {
          const saleDetail = saleDetailsBySaleId.get(row.original.id);
          if (!saleDetail) {
            return (
              <span className="text-muted-foreground text-sm">
                Carregando...
              </span>
            );
          }

          const renderedValue = resolveSaleDynamicFieldDisplayValue(
            saleDetail,
            field,
          );

          return (
            <span className="block max-w-[180px] truncate">
              {renderedValue}
            </span>
          );
        },
      })),
      {
        accessorKey: "updatedAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Atualização
            <ArrowUpDown className="ml-2 size-4" />
          </Button>
        ),
        cell: ({ row }) => formatDateTime(row.original.updatedAt),
      },
      {
        id: "actions",
        enableHiding: false,
        header: ({ table }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Mostrar ou ocultar colunas"
                  title="Colunas"
                >
                  <ListFilter className="size-4" />
                  <span className="sr-only">Colunas</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="max-h-80 overflow-y-auto"
              >
                {(() => {
                  const hideableColumns = table
                    .getAllColumns()
                    .filter((column) => column.getCanHide());
                  const defaultColumns = hideableColumns.filter(
                    (column) =>
                      !column.id.startsWith(SALE_DYNAMIC_FIELD_COLUMN_PREFIX),
                  );
                  const dynamicColumns = hideableColumns.filter((column) =>
                    column.id.startsWith(SALE_DYNAMIC_FIELD_COLUMN_PREFIX),
                  );

                  return (
                    <>
                      {defaultColumns.length > 0 ? (
                        <>
                          <DropdownMenuLabel>Colunas padrão</DropdownMenuLabel>
                          {defaultColumns.map((column) => (
                            <DropdownMenuCheckboxItem
                              key={column.id}
                              className="capitalize"
                              checked={column.getIsVisible()}
                              onCheckedChange={(value) =>
                                column.toggleVisibility(Boolean(value))
                              }
                            >
                              {getColumnVisibilityLabel(
                                column.id,
                                dynamicFieldLabelByColumnId,
                              )}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </>
                      ) : null}

                      {dynamicColumns.length > 0 ? (
                        <>
                          {defaultColumns.length > 0 ? (
                            <DropdownMenuSeparator />
                          ) : null}
                          <DropdownMenuLabel>
                            Campos personalizados
                          </DropdownMenuLabel>
                          {dynamicColumns.map((column) => (
                            <DropdownMenuCheckboxItem
                              key={column.id}
                              checked={column.getIsVisible()}
                              onCheckedChange={(value) =>
                                column.toggleVisibility(Boolean(value))
                              }
                            >
                              {getColumnVisibilityLabel(
                                column.id,
                                dynamicFieldLabelByColumnId,
                              )}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </>
                      ) : null}
                    </>
                  );
                })()}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-end">
            <SaleTableRowActions
              sale={row.original}
              onOpenInstallments={(sale) => setInstallmentsDrawerSale(sale)}
              onNavigateSale={handlePersistSaleNavigationContext}
            />
          </div>
        ),
      },
    ],
    [
      canViewAllCommissions,
      canAccessCommissionInstallments,
      canUseBulkActions,
      dynamicFieldColumnsReady,
      dynamicFieldLabelByColumnId,
      handlePersistSaleNavigationContext,
      saleDetailsBySaleId,
    ],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination: {
        pageIndex: currentPage - 1,
        pageSize: SALES_PAGE_SIZE,
      },
      rowSelection,
    },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    globalFilterFn: salesGlobalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const salesSummaryRows = table.getFilteredRowModel().rows;
  const salesSummary = useMemo(() => {
    const paid = { count: 0, amount: 0 };
    const pending = { count: 0, amount: 0 };
    const canceled = { count: 0, amount: 0 };

    for (const row of salesSummaryRows) {
      const sale = row.original;

      if (sale.status === "COMPLETED") {
        paid.count += 1;
        paid.amount += sale.totalAmount;
        continue;
      }

      if (sale.status === "CANCELED") {
        canceled.count += 1;
        canceled.amount += sale.totalAmount;
        continue;
      }

      pending.count += 1;
      pending.amount += sale.totalAmount;
    }

    return {
      totalPeriod: {
        count: paid.count + pending.count,
        amount: paid.amount + pending.amount,
      },
      paid,
      pending,
      canceled,
    };
  }, [salesSummaryRows]);

  const salesSummaryCards = [
    {
      id: "totalPeriod",
      label: "Total no período",
      subtitle: "Pagas + pendentes",
      valueClassName: "text-foreground",
      data: salesSummary.totalPeriod,
    },
    {
      id: "paid",
      label: "Pagas",
      subtitle: "Status concluída",
      valueClassName: "text-emerald-700 dark:text-emerald-300",
      data: salesSummary.paid,
    },
    {
      id: "pending",
      label: "Pendentes",
      subtitle: "Pendente + aprovada",
      valueClassName: "text-amber-700 dark:text-amber-300",
      data: salesSummary.pending,
    },
    {
      id: "canceled",
      label: "Canceladas",
      subtitle: "Fora do total",
      valueClassName: "text-rose-700 dark:text-rose-300",
      data: salesSummary.canceled,
    },
  ] as const;

  useEffect(() => {
    const pageCount = table.getPageCount();
    const nextPage = pageCount <= 0 ? 1 : Math.min(currentPage, pageCount);

    if (nextPage !== currentPage) {
      void setPage(nextPage);
    }
  }, [
    currentPage,
    setPage,
    table,
    tableData,
    globalFilter,
    columnFilters,
    sorting,
  ]);
  saleNavigationOrderedIdsRef.current = table
    .getSortedRowModel()
    .rows.map((row) => row.original.id);
  const desktopTableMinWidthPx = Math.max(
    table.getVisibleLeafColumns().length * 120,
    840,
  );
  const visibleSaleIds = table.getRowModel().rows.map((row) => row.original.id);

  function toggleSaleSelectionById(saleId: string, checked: boolean) {
    if (!canUseBulkActions) {
      return;
    }

    setRowSelection((current) => {
      const next = { ...current };
      if (checked) {
        next[saleId] = true;
      } else {
        delete next[saleId];
      }

      return next;
    });
  }

  function toggleVisibleSalesSelection(saleIds: string[], checked: boolean) {
    if (!canUseBulkActions) {
      return;
    }

    setRowSelection((current) => {
      const next = { ...current };
      for (const saleId of saleIds) {
        if (checked) {
          next[saleId] = true;
        } else {
          delete next[saleId];
        }
      }

      return next;
    });
  }

  const saleMultiSelect = useCheckboxMultiSelect<string>({
    visibleIds: visibleSaleIds,
    isSelectable: () => canUseBulkActions,
    toggleOne: toggleSaleSelectionById,
    toggleMany: toggleVisibleSalesSelection,
    onClearSelection: () => {
      setRowSelection({});
      setBulkStatus("");
    },
    enabled: canUseBulkActions,
  });

  saleCheckboxClickHandlerRef.current = saleMultiSelect.onCheckboxClick;
  saleCheckboxCheckedChangeHandlerRef.current =
    saleMultiSelect.onCheckboxCheckedChange;

  const selectedSales = table
    .getSelectedRowModel()
    .rows.map((row) => row.original);
  const selectedSaleIds = selectedSales.map((sale) => sale.id);
  const showResponsibleFilter = responsibleTypeFilter !== "ALL";

  const availableBulkStatuses = useMemo<SaleStatus[]>(() => {
    if (selectedSales.length === 0) {
      return [];
    }

    const allowedStatuses = selectedSales.reduce<Set<SaleStatus>>(
      (accumulator, sale, index) => {
        const saleAllowedStatuses = new Set(
          SALE_STATUS_TRANSITIONS[sale.status as SaleStatus],
        );

        if (index === 0) {
          return saleAllowedStatuses;
        }

        return new Set(
          Array.from(accumulator).filter((status) =>
            saleAllowedStatuses.has(status),
          ),
        );
      },
      new Set<SaleStatus>(),
    );

    return SaleStatusSchema.options.filter((status) =>
      allowedStatuses.has(status),
    );
  }, [selectedSales]);

  useEffect(() => {
    if (!bulkStatus) {
      return;
    }

    if (!availableBulkStatuses.includes(bulkStatus)) {
      setBulkStatus("");
    }
  }, [availableBulkStatuses, bulkStatus]);

  async function handleApplyBulkStatus() {
    if (!bulkStatus || selectedSaleIds.length === 0) {
      return;
    }

    try {
      await patchSalesStatusBulk({
        saleIds: selectedSaleIds,
        status: bulkStatus,
      });
      setRowSelection({});
      setBulkStatus("");
    } catch {
      // erro tratado no hook
    }
  }

  async function handleConfirmBulkDelete() {
    if (selectedSaleIds.length === 0) {
      return;
    }

    try {
      await deleteSalesBulk({
        saleIds: selectedSaleIds,
      });
      setRowSelection({});
      setBulkStatus("");
      setBulkDeleteDialogOpen(false);
    } catch {
      // erro tratado no hook
    }
  }

  function clearFilters() {
    setRowSelection({});
    void setGlobalFilter("");
    void setStatusFilter("ALL");
    void setCompanyIdFilter("");
    void setUnitIdFilter("");
    void setResponsibleTypeFilter("ALL");
    void setResponsibleIdFilter("");
    void setSaleDateFromFilter("");
    void setSaleDateToFilter("");
    void setPage(1);
  }

  if (isLoading) {
    return <CardSectionSkeleton rows={6} cardClassName="p-6" />;
  }

  if (isError) {
    return (
      <Card className="p-6 flex flex-col gap-4">
        <p className="text-destructive">Erro ao carregar vendas.</p>
        <Button variant="outline" className="w-fit" onClick={onRetry}>
          <RefreshCcw className="size-4" />
          Tentar novamente
        </Button>
      </Card>
    );
  }

  if (sales.length === 0) {
    return (
      <Card className="p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-lg">Nenhuma venda cadastrada</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre sua primeira venda para começar a acompanhar o pipeline.
          </p>
        </div>
        {canCreateSale ? (
          <Button asChild className="w-fit">
            <Link to="/sales/create">
              <Plus className="size-4" />
              Nova Venda
            </Link>
          </Button>
        ) : null}
      </Card>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {salesSummaryCards.map((card) => (
          <Card
            key={card.id}
            className="border-border/70 bg-muted/20 p-4 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{card.label}</span>
              <span className="text-xs text-muted-foreground">
                {formatCount(card.data.count)}
              </span>
            </div>
            <p className={`text-lg font-semibold ${card.valueClassName}`}>
              {formatCurrencyBRL(card.data.amount / 100)}
            </p>
            <p className="text-xs text-muted-foreground">{card.subtitle}</p>
          </Card>
        ))}
      </div>

      {showFilters ? (
        <FilterPanel
          className={`lg:grid-cols-4 xl:items-end ${
            showResponsibleFilter ? "xl:grid-cols-10" : "xl:grid-cols-9"
          }`}
        >
          <div className="space-y-1 xl:col-span-2">
            <p className="text-xs text-muted-foreground">Busca</p>
            <Input
              placeholder="Buscar por cliente, produto (com hierarquia) ou empresa..."
              value={globalFilter}
              onChange={(event) => {
                void setGlobalFilter(event.target.value);
                void setPage(1);
              }}
              className="w-full"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Empresa</p>
            <Select
              value={companyIdFilter || "ALL"}
              onValueChange={(value) => {
                void setCompanyIdFilter(value === "ALL" ? "" : value);
                void setUnitIdFilter("");
                void setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as empresas</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Unidade</p>
            <Select
              value={unitIdFilter || "ALL"}
              onValueChange={(value) => {
                void setUnitIdFilter(value === "ALL" ? "" : value);
                void setPage(1);
              }}
              disabled={!companyIdFilter}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas as unidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as unidades</SelectItem>
                {unitsBySelectedCompany.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Status</p>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                void setStatusFilter(value as SaleStatusFilter);
                void setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                {SaleStatusSchema.options.map((status) => (
                  <SelectItem key={status} value={status}>
                    {SALE_STATUS_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Data de venda de</p>
            <CalendarDateInput
              value={saleDateFromFilter}
              locale={ptBR}
              onChange={(value) => {
                void setSaleDateFromFilter(value);
                if (value && saleDateToFilter && saleDateToFilter < value) {
                  void setSaleDateToFilter(value);
                }
                void setPage(1);
              }}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Data de venda até</p>
            <CalendarDateInput
              value={saleDateToFilter}
              locale={ptBR}
              onChange={(value) => {
                void setSaleDateToFilter(value);
                if (value && saleDateFromFilter && saleDateFromFilter > value) {
                  void setSaleDateFromFilter(value);
                }
                void setPage(1);
              }}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Tipo de responsável</p>
            <Select
              value={responsibleTypeFilter}
              onValueChange={(value) => {
                void setResponsibleTypeFilter(
                  value as SaleResponsibleTypeFilter,
                );
                void setResponsibleIdFilter("");
                void setPage(1);
              }}
            >
              <SelectTrigger
                className="w-full"
                aria-label="Tipo de responsável"
              >
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="COMPANY">Empresa</SelectItem>
                <SelectItem value="UNIT">Unidade</SelectItem>
                <SelectItem value="SELLER">Vendedor</SelectItem>
                <SelectItem value="PARTNER">Parceiro</SelectItem>
                <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                <SelectItem value="OTHER">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showResponsibleFilter ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {
                  SALE_RESPONSIBLE_TYPE_LABEL[
                    responsibleTypeFilter as SaleResponsibleType
                  ]
                }
              </p>
              <Select
                value={responsibleIdFilter || "ALL"}
                onValueChange={(value) => {
                  void setResponsibleIdFilter(value === "ALL" ? "" : value);
                  void setPage(1);
                }}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label={
                    SALE_RESPONSIBLE_TYPE_LABEL[
                      responsibleTypeFilter as SaleResponsibleType
                    ]
                  }
                >
                  <SelectValue
                    placeholder={`Todos: ${
                      SALE_RESPONSIBLE_TYPE_LABEL[
                        responsibleTypeFilter as SaleResponsibleType
                      ]
                    }`}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    Todos:{" "}
                    {
                      SALE_RESPONSIBLE_TYPE_LABEL[
                        responsibleTypeFilter as SaleResponsibleType
                      ]
                    }
                  </SelectItem>
                  {responsibleOptions.map((responsibleOption) => (
                    <SelectItem
                      key={responsibleOption.id}
                      value={responsibleOption.id}
                    >
                      {responsibleOption.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="w-full xl:justify-self-stretch"
            onClick={clearFilters}
          >
            <RefreshCcw className="size-4" />
            Limpar
          </Button>
        </FilterPanel>
      ) : null}

      {selectedSaleIds.length > 0 && canUseBulkActions ? (
        <div className="flex flex-col gap-3 rounded-md border border-blue-500/30 bg-blue-500/10 p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {selectedSaleIds.length} venda(s) selecionada(s)
          </p>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            {canChangeSaleStatus ? (
              <>
                <Select
                  value={bulkStatus || undefined}
                  onValueChange={(value) => setBulkStatus(value as SaleStatus)}
                  disabled={availableBulkStatuses.length === 0}
                >
                  <SelectTrigger className="w-full md:w-52">
                    <SelectValue
                      placeholder={
                        availableBulkStatuses.length === 0
                          ? "Sem transição disponível"
                          : "Novo status"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBulkStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {SALE_STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={() => void handleApplyBulkStatus()}
                  disabled={!bulkStatus || isBulkStatusPending}
                >
                  {isBulkStatusPending
                    ? "Aplicando..."
                    : "Alterar status em lote"}
                </Button>
              </>
            ) : null}
            {canDeleteSale ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setBulkDeleteDialogOpen(true)}
                disabled={isBulkDeletePending}
              >
                {isBulkDeletePending ? "Excluindo..." : "Excluir em lote"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {canDeleteSale ? (
        <AlertDialog
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir vendas em lote</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir{" "}
                <strong>{selectedSaleIds.length}</strong> venda(s)
                selecionada(s)? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isBulkDeletePending}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => void handleConfirmBulkDelete()}
                disabled={isBulkDeletePending}
              >
                {isBulkDeletePending ? "Excluindo..." : "Confirmar exclusão"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      <ResponsiveDataView
        desktopClassName="w-full min-w-0 max-w-full"
        mobile={
          <div className="space-y-3">
            {canUseBulkActions ? (
              <Card className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={
                        table.getIsAllPageRowsSelected()
                          ? true
                          : table.getIsSomePageRowsSelected()
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(value) =>
                        table.toggleAllPageRowsSelected(Boolean(value))
                      }
                      aria-label="Selecionar página atual"
                    />
                    <span>Selecionar vendas da página</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {table.getRowModel().rows.length} registro(s)
                  </span>
                </div>
              </Card>
            ) : null}

            {table.getRowModel().rows.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Nenhum resultado encontrado para os filtros aplicados.
              </Card>
            ) : (
              table.getRowModel().rows.map((row) => {
                const sale = row.original;
                const canEditSale =
                  canUpdateSale || (canCreateSale && sale.status === "PENDING");
                const summary = sale.commissionInstallmentsSummary;

                return (
                  <Card
                    key={row.id}
                    className={`space-y-3 p-4 ${
                      sale.delinquencySummary.hasOpen
                        ? "border-rose-500/30 bg-rose-500/5"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {sale.customer.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {sale.productLabel}
                        </p>
                        <SaleDelinquencyBadge
                          summary={sale.delinquencySummary}
                          className="mt-2"
                          showOldestDueDate
                        />
                      </div>
                      <Checkbox
                        checked={row.getIsSelected()}
                        onClick={(event) =>
                          saleCheckboxClickHandlerRef.current(
                            row.original.id,
                            event,
                          )
                        }
                        onCheckedChange={(value) =>
                          saleCheckboxCheckedChangeHandlerRef.current(
                            row.original.id,
                            Boolean(value),
                          )
                        }
                        disabled={!canUseBulkActions}
                        aria-label={`Selecionar venda ${sale.id}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">Data</p>
                        <p>{formatSaleDate(sale.saleDate)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">Atualização</p>
                        <p>{formatDateTime(sale.updatedAt)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">Empresa</p>
                        <p>{sale.company.name}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">Unidade</p>
                        <p>{sale.unit?.name ?? "Sem unidade"}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <SaleStatusBadge status={sale.status as SaleStatus} />
                        <SalePreCancellationBadge
                          threshold={preCancellationDelinquencyThreshold}
                          summary={sale.delinquencySummary}
                        />
                      </div>
                      <p
                        className={
                          sale.totalAmount === 0
                            ? "text-sm font-semibold text-muted-foreground"
                            : "text-sm font-semibold"
                        }
                      >
                        {formatCurrencyBRL(sale.totalAmount / 100)}
                      </p>
                    </div>

                    {canViewAllCommissions ? (
                      <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                        Parcelas:{" "}
                        {summary.total === 0
                          ? "Sem parcelas"
                          : `${summary.paid}/${summary.total} pagas`}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          to="/sales/$saleId"
                          params={{ saleId: sale.id }}
                          onClick={handlePersistSaleNavigationContext}
                        >
                          <Eye className="size-4" />
                          Detalhes
                        </Link>
                      </Button>
                      {canEditSale ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            to="/sales/update/$saleId"
                            params={{ saleId: sale.id }}
                            onClick={handlePersistSaleNavigationContext}
                          >
                            <Pencil className="size-4" />
                            Editar
                          </Link>
                        </Button>
                      ) : null}
                      {canCreateSale ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            to="/sales/create"
                            search={{ duplicateSaleId: sale.id }}
                          >
                            <Copy className="size-4" />
                            Duplicar
                          </Link>
                        </Button>
                      ) : null}
                      {canAccessCommissionInstallments ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="!min-h-8"
                          disabled={summary.total === 0}
                          onClick={() => setInstallmentsDrawerSale(sale)}
                        >
                          <ListTree className="size-4" />
                          Parcelas
                        </Button>
                      ) : null}
                    </div>

                    {canChangeSaleStatus ? (
                      <SaleStatusAction
                        saleId={sale.id}
                        currentStatus={sale.status as SaleStatus}
                      />
                    ) : null}
                  </Card>
                );
              })
            )}
          </div>
        }
        desktop={
          <div className="w-full max-w-full overflow-hidden rounded-md border bg-card">
            <ScrollArea
              type="always"
              scrollHideDelay={0}
              className="w-full max-w-full"
            >
              <table
                className="caption-bottom text-sm"
                style={{ width: `max(100%, ${desktopTableMinWidthPx}px)` }}
              >
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length > 0 ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        Nenhum resultado encontrado para os filtros aplicados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <span className="text-sm text-muted-foreground">
          Página {table.getState().pagination.pageIndex + 1} de{" "}
          {table.getPageCount()}
        </span>
        <div className="flex w-full items-center gap-2 md:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 md:flex-none"
            onClick={() => void setPage(Math.max(1, currentPage - 1))}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 md:flex-none"
            onClick={() => void setPage(currentPage + 1)}
            disabled={!table.getCanNextPage()}
          >
            Próxima
          </Button>
        </div>
      </div>

      {installmentsDrawerSale ? (
        <SaleInstallmentsDrawer
          open={Boolean(installmentsDrawerSale)}
          onOpenChange={(open) => {
            if (!open) {
              setInstallmentsDrawerSale(null);
            }
          }}
          saleId={installmentsDrawerSale.id}
          saleStatus={installmentsDrawerSale.status as SaleStatus}
          saleProductId={installmentsDrawerSale.product.id}
        />
      ) : null}
    </div>
  );
}
