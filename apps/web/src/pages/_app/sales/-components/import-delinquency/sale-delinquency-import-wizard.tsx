import { Link } from "@tanstack/react-router";
import { format, parse } from "date-fns";
import {
	AlertCircle,
	CheckCircle2,
	FileSpreadsheet,
	Loader2,
	Plus,
	Save,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CardSectionSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useApp } from "@/context/app-context";
import {
	useApplySaleDelinquencyImport,
	useCreateSaleDelinquencyImportTemplate,
	useDeleteSaleDelinquencyImportTemplate,
	usePreviewSaleDelinquencyImport,
	useSaleDelinquencyImportSearchFields,
	useSaleDelinquencyImportTemplates,
	useUpdateSaleDelinquencyImportTemplate,
} from "@/hooks/sales";
import { useGetOrganizationsSlugProducts } from "@/http/generated";
import {
	MAX_IMPORT_ROWS,
	type ParsedImportFile,
	parseSpreadsheetFile,
} from "@/pages/_app/sales/-components/import-sales/utils";
import type {
	SaleDelinquencyImportApplyResult,
	SaleDelinquencyImportPreviewRowStatus,
	SaleDelinquencyImportTemplate,
	SaleDelinquencyImportTemplateFields,
} from "@/schemas/types/sale-delinquency-import";
import {
	buildAutoSelectedSaleDelinquencyRowNumbers,
	buildSaleDelinquencyImportResultRows,
	buildSaleDelinquencyPreviewUiRows,
	buildSuggestedSaleDelinquencyImportMapping,
	isSaleDelinquencyPreviewRowReady,
	normalizeImportHeader,
} from "./sale-delinquency-import-helpers";

type WizardStep = "UPLOAD" | "MAPPING" | "IMPORT_DATE" | "PREVIEW" | "RESULT";
type PreviewStatusFilter = "ALL" | SaleDelinquencyImportPreviewRowStatus;

const STATUS_BADGE_CLASSNAME: Record<
	SaleDelinquencyImportPreviewRowStatus,
	string
> = {
	READY: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
	NO_ACTION: "bg-slate-500/15 text-slate-700 border-slate-500/30",
	ATTENTION: "bg-amber-500/15 text-amber-700 border-amber-500/30",
	ERROR: "bg-red-500/15 text-red-700 border-red-500/30",
};

const EMPTY_MAPPING: SaleDelinquencyImportTemplateFields = {
	saleDateColumn: "",
	customFieldMappings: [],
};

type ProductTreeNode = {
	id: string;
	name: string;
	children?: ProductTreeNode[];
};

type ProductOption = {
	id: string;
	label: string;
};

function getDefaultImportDate() {
	return format(new Date(), "yyyy-MM-dd");
}

function getStepLabel(step: WizardStep) {
	if (step === "UPLOAD") {
		return "1. Upload";
	}

	if (step === "MAPPING") {
		return "2. Mapeamento";
	}

	if (step === "IMPORT_DATE") {
		return "3. Data da importação";
	}

	if (step === "PREVIEW") {
		return "4. Prévia";
	}

	return "5. Resultado";
}

function getStatusLabel(status: SaleDelinquencyImportPreviewRowStatus) {
	if (status === "READY") {
		return "Pronta";
	}

	if (status === "NO_ACTION") {
		return "Sem ação";
	}

	if (status === "ATTENTION") {
		return "Atenção";
	}

	return "Erro";
}

function formatDateLabel(value: string | null) {
	if (!value) {
		return "-";
	}

	try {
		return format(
			parse(value.slice(0, 10), "yyyy-MM-dd", new Date()),
			"dd/MM/yyyy",
		);
	} catch {
		return value;
	}
}

function getResultBadgeClass(result: "APPLIED" | "SKIPPED") {
	return result === "APPLIED"
		? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
		: "bg-slate-500/15 text-slate-700 border-slate-500/30";
}

function getResultLabel(result: "APPLIED" | "SKIPPED") {
	return result === "APPLIED" ? "Aplicada" : "Ignorada";
}

function flattenProductOptions(
	nodes: ProductTreeNode[],
	parentPath: string[] = [],
): ProductOption[] {
	const options: ProductOption[] = [];

	for (const node of nodes) {
		const currentPath = [...parentPath, node.name];
		options.push({
			id: node.id,
			label: currentPath.join(" -> "),
		});

		const children = Array.isArray(node.children) ? node.children : [];
		options.push(...flattenProductOptions(children, currentPath));
	}

	return options;
}

function validateImportDate(value: string) {
	if (!value) {
		return false;
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}

	return value <= format(new Date(), "yyyy-MM-dd");
}

function validateMapping(mapping: SaleDelinquencyImportTemplateFields) {
	if (!mapping.saleDateColumn) {
		return "Selecione a coluna da data da venda.";
	}

	if (mapping.customFieldMappings.length === 0) {
		return "Adicione ao menos um campo personalizado para busca.";
	}

	const usedColumns = new Set<string>([mapping.saleDateColumn]);
	const usedFieldLabels = new Set<string>();

	for (const [index, customField] of mapping.customFieldMappings.entries()) {
		if (!customField.customFieldLabel) {
			return `Selecione o campo personalizado na linha ${index + 1}.`;
		}

		if (!customField.columnKey) {
			return `Selecione a coluna da planilha na linha ${index + 1}.`;
		}

		const normalizedFieldLabel = normalizeImportHeader(
			customField.customFieldLabel,
		);
		if (usedFieldLabels.has(normalizedFieldLabel)) {
			return "Cada campo personalizado deve ser usado apenas uma vez.";
		}
		usedFieldLabels.add(normalizedFieldLabel);

		if (usedColumns.has(customField.columnKey)) {
			return "Cada coluna da planilha deve ser usada apenas uma vez.";
		}
		usedColumns.add(customField.columnKey);
	}

	return null;
}

function normalizeMappingForRequest(
	mapping: SaleDelinquencyImportTemplateFields,
): SaleDelinquencyImportTemplateFields {
	return {
		saleDateColumn: mapping.saleDateColumn,
		customFieldMappings: mapping.customFieldMappings
			.map((customField) => ({
				customFieldLabel: customField.customFieldLabel.trim(),
				columnKey: customField.columnKey,
			}))
			.filter(
				(customField) =>
					customField.customFieldLabel.length > 0 &&
					customField.columnKey.length > 0,
			),
	};
}

function buildTemplatePayload(params: {
	name: string;
	headerSignature: string;
	mapping: SaleDelinquencyImportTemplateFields;
}) {
	return {
		name: params.name,
		headerSignature: params.headerSignature,
		mapping: {
			fields: normalizeMappingForRequest(params.mapping),
		},
	};
}

export function SaleDelinquencyImportWizard() {
	const { organization } = useApp();
	const slug = organization?.slug ?? "";
	const [step, setStep] = useState<WizardStep>("UPLOAD");
	const [parsedFile, setParsedFile] = useState<ParsedImportFile | null>(null);
	const [importRows, setImportRows] = useState<Array<Record<string, unknown>>>(
		[],
	);
	const [mapping, setMapping] =
		useState<SaleDelinquencyImportTemplateFields>(EMPTY_MAPPING);
	const [importDate, setImportDate] = useState(getDefaultImportDate());
	const [selectedProductId, setSelectedProductId] = useState("");
	const [selectedTemplateId, setSelectedTemplateId] = useState("");
	const [templateName, setTemplateName] = useState("");
	const [previewResult, setPreviewResult] = useState<{
		summary: {
			totalRows: number;
			readyRows: number;
			noActionRows: number;
			attentionRows: number;
			errorRows: number;
		};
		rows: ReturnType<typeof buildSaleDelinquencyPreviewUiRows>;
	} | null>(null);
	const [applyResult, setApplyResult] =
		useState<SaleDelinquencyImportApplyResult | null>(null);
	const [statusFilter, setStatusFilter] = useState<PreviewStatusFilter>("ALL");
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedRows, setSelectedRows] = useState(() => new Set<number>());
	const [isParsingFile, setIsParsingFile] = useState(false);

	const productsQuery = useGetOrganizationsSlugProducts(
		{ slug },
		{
			query: {
				enabled: Boolean(slug),
			},
		},
	);
	const templatesQuery = useSaleDelinquencyImportTemplates({
		headerSignature: parsedFile?.headerSignature,
		enabled: Boolean(parsedFile?.headerSignature),
	});
	const searchFieldsQuery = useSaleDelinquencyImportSearchFields({
		productId: selectedProductId || undefined,
		enabled: true,
	});
	const createTemplate = useCreateSaleDelinquencyImportTemplate();
	const updateTemplate = useUpdateSaleDelinquencyImportTemplate();
	const deleteTemplate = useDeleteSaleDelinquencyImportTemplate();
	const previewImport = usePreviewSaleDelinquencyImport();
	const applyImport = useApplySaleDelinquencyImport();

	const productOptions = useMemo(
		() =>
			flattenProductOptions(
				(productsQuery.data?.products as ProductTreeNode[] | undefined) ?? [],
			),
		[productsQuery.data?.products],
	);
	const templates = templatesQuery.data?.templates ?? [];
	const availableCustomFieldLabels = useMemo(
		() => searchFieldsQuery.data?.fields.map((field) => field.label) ?? [],
		[searchFieldsQuery.data?.fields],
	);
	const spreadsheetHeaders = parsedFile?.headers ?? [];

	const filteredPreviewRows = useMemo(() => {
		if (!previewResult) {
			return [];
		}

		const normalizedSearch = normalizeImportHeader(searchTerm);

		return previewResult.rows.filter((row) => {
			if (statusFilter !== "ALL" && row.status !== statusFilter) {
				return false;
			}

			if (!normalizedSearch) {
				return true;
			}

			const searchableContent = [
				String(row.rowNumber),
				row.saleDate ?? "",
				row.dueDate ?? "",
				row.saleId ?? "",
				row.reason,
				...row.customFieldValues.map(
					(fieldValue) =>
						`${fieldValue.customFieldLabel} ${fieldValue.value ?? ""}`,
				),
			]
				.join(" ")
				.normalize("NFD")
				.replace(/\p{Diacritic}/gu, "")
				.toLowerCase();

			return searchableContent.includes(normalizedSearch);
		});
	}, [previewResult, searchTerm, statusFilter]);

	const filteredReadyRows = useMemo(
		() =>
			filteredPreviewRows.filter((row) =>
				isSaleDelinquencyPreviewRowReady(row),
			),
		[filteredPreviewRows],
	);
	const filteredReadyRowNumbers = useMemo(
		() => filteredReadyRows.map((row) => row.rowNumber),
		[filteredReadyRows],
	);

	const allFilteredReadySelected =
		filteredReadyRowNumbers.length > 0 &&
		filteredReadyRowNumbers.every((rowNumber) => selectedRows.has(rowNumber));

	const resultRows = useMemo(() => {
		if (!previewResult || !applyResult) {
			return [];
		}

		return buildSaleDelinquencyImportResultRows({
			previewRows: previewResult.rows,
			applyRows: applyResult.results,
		});
	}, [previewResult, applyResult]);

	useEffect(() => {
		if (!parsedFile || step !== "MAPPING") {
			return;
		}

		if (!templates.length || selectedTemplateId) {
			return;
		}

		const suggestedTemplate = templates.find(
			(template) => template.isSuggested,
		);
		if (!suggestedTemplate) {
			return;
		}

		applyTemplate(suggestedTemplate);
	}, [parsedFile, step, templates, selectedTemplateId]);

	useEffect(() => {
		if (!parsedFile || step !== "MAPPING" || selectedTemplateId) {
			return;
		}

		const suggestedMapping = buildSuggestedSaleDelinquencyImportMapping({
			headers: parsedFile.headers,
			customFieldLabels: availableCustomFieldLabels,
		});

		setMapping((currentMapping) => {
			const shouldUpdateSaleDate =
				!currentMapping.saleDateColumn &&
				Boolean(suggestedMapping.saleDateColumn);
			const shouldUpdateCustomFields =
				currentMapping.customFieldMappings.length === 0 &&
				suggestedMapping.customFieldMappings.length > 0;

			if (!shouldUpdateSaleDate && !shouldUpdateCustomFields) {
				return currentMapping;
			}

			return {
				...currentMapping,
				saleDateColumn: shouldUpdateSaleDate
					? suggestedMapping.saleDateColumn
					: currentMapping.saleDateColumn,
				customFieldMappings: shouldUpdateCustomFields
					? suggestedMapping.customFieldMappings
					: currentMapping.customFieldMappings,
			};
		});
	}, [availableCustomFieldLabels, parsedFile, selectedTemplateId, step]);

	function applyTemplate(template: SaleDelinquencyImportTemplate) {
		setSelectedTemplateId(template.id);
		setTemplateName(template.name);
		setMapping(template.mapping.fields);
	}

	function resetWizard() {
		setStep("UPLOAD");
		setParsedFile(null);
		setImportRows([]);
		setMapping(EMPTY_MAPPING);
		setImportDate(getDefaultImportDate());
		setSelectedProductId("");
		setSelectedTemplateId("");
		setTemplateName("");
		setPreviewResult(null);
		setApplyResult(null);
		setStatusFilter("ALL");
		setSearchTerm("");
		setSelectedRows(new Set<number>());
	}

	async function handleSelectFile(file: File) {
		setIsParsingFile(true);
		try {
			const nextParsedFile = await parseSpreadsheetFile(file);
			setParsedFile(nextParsedFile);
			setImportRows(nextParsedFile.rows);
			setImportDate(getDefaultImportDate());
			setSelectedTemplateId("");
			setTemplateName("");
			setPreviewResult(null);
			setApplyResult(null);
			setStatusFilter("ALL");
			setSearchTerm("");
			setSelectedRows(new Set<number>());
			setMapping(
				buildSuggestedSaleDelinquencyImportMapping({
					headers: nextParsedFile.headers,
					customFieldLabels: availableCustomFieldLabels,
				}),
			);
			setStep("MAPPING");
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Não foi possível ler a planilha.";
			toast.error(message);
		} finally {
			setIsParsingFile(false);
		}
	}

	function handleProductSelectionChange(value: string) {
		const nextSelectedProductId = value === "ALL" ? "" : value;
		setSelectedProductId(nextSelectedProductId);

		if (!selectedTemplateId) {
			setMapping((currentMapping) => ({
				...currentMapping,
				customFieldMappings: [],
			}));
		}
	}

	function handleAddCustomFieldMapping() {
		const selectedLabels = new Set(
			mapping.customFieldMappings.map(
				(customField) => customField.customFieldLabel,
			),
		);
		const selectedColumns = new Set(
			mapping.customFieldMappings.map((customField) => customField.columnKey),
		);
		selectedColumns.add(mapping.saleDateColumn);

		const nextLabel =
			availableCustomFieldLabels.find((label) => !selectedLabels.has(label)) ??
			"";
		const nextColumn =
			spreadsheetHeaders.find((header) => !selectedColumns.has(header)) ?? "";

		setMapping((currentMapping) => ({
			...currentMapping,
			customFieldMappings: [
				...currentMapping.customFieldMappings,
				{
					customFieldLabel: nextLabel,
					columnKey: nextColumn,
				},
			],
		}));
	}

	function updateCustomFieldMapping(
		index: number,
		patch: Partial<
			SaleDelinquencyImportTemplateFields["customFieldMappings"][number]
		>,
	) {
		setMapping((currentMapping) => ({
			...currentMapping,
			customFieldMappings: currentMapping.customFieldMappings.map(
				(customField, currentIndex) => {
					if (currentIndex !== index) {
						return customField;
					}

					return {
						...customField,
						...patch,
					};
				},
			),
		}));
	}

	function removeCustomFieldMapping(index: number) {
		setMapping((currentMapping) => ({
			...currentMapping,
			customFieldMappings: currentMapping.customFieldMappings.filter(
				(_, currentIndex) => currentIndex !== index,
			),
		}));
	}

	async function handleSaveTemplate() {
		if (!parsedFile) {
			toast.error("Envie uma planilha para salvar o template.");
			return;
		}

		const normalizedName = templateName.trim();
		if (!normalizedName) {
			toast.error("Informe um nome para o template.");
			return;
		}

		const mappingError = validateMapping(mapping);
		if (mappingError) {
			toast.error(mappingError);
			return;
		}

		const payload = buildTemplatePayload({
			name: normalizedName,
			headerSignature: parsedFile.headerSignature,
			mapping,
		});

		if (selectedTemplateId) {
			try {
				await updateTemplate.mutateAsync({
					templateId: selectedTemplateId,
					data: payload,
				});
			} catch {
				// error feedback is handled by hook toast
			}
			return;
		}

		try {
			const created = await createTemplate.mutateAsync(payload);
			setSelectedTemplateId(created.templateId);
		} catch {
			// error feedback is handled by hook toast
		}
	}

	async function handleDeleteTemplate() {
		if (!selectedTemplateId) {
			return;
		}

		try {
			await deleteTemplate.mutateAsync(selectedTemplateId);
			setSelectedTemplateId("");
			setTemplateName("");
		} catch {
			// error feedback is handled by hook toast
		}
	}

	function handleOpenImportDateStep() {
		if (!parsedFile) {
			toast.error("Envie uma planilha para continuar.");
			return;
		}

		const mappingError = validateMapping(mapping);
		if (mappingError) {
			toast.error(mappingError);
			return;
		}

		setStep("IMPORT_DATE");
	}

	async function handleRunPreview() {
		if (!parsedFile) {
			toast.error("Envie uma planilha para continuar.");
			return;
		}

		if (!validateImportDate(importDate)) {
			toast.error("Informe uma data de importação válida (sem datas futuras).");
			return;
		}

		const mappingError = validateMapping(mapping);
		if (mappingError) {
			toast.error(mappingError);
			return;
		}

		let preview: Awaited<ReturnType<typeof previewImport.mutateAsync>>;
		try {
			preview = await previewImport.mutateAsync({
				fileType: parsedFile.fileType,
				headerSignature: parsedFile.headerSignature,
				templateId: selectedTemplateId || undefined,
				importDate,
				rows: importRows,
				mapping: {
					fields: normalizeMappingForRequest(mapping),
				},
			});
		} catch {
			// error feedback is handled by hook toast
			return;
		}

		const previewRows = buildSaleDelinquencyPreviewUiRows(preview.rows);
		setPreviewResult({
			summary: preview.summary,
			rows: previewRows,
		});
		setApplyResult(null);
		setStatusFilter("ALL");
		setSearchTerm("");
		setSelectedRows(
			new Set(buildAutoSelectedSaleDelinquencyRowNumbers(previewRows)),
		);
		setStep("PREVIEW");
	}

	function togglePreviewRowSelection(rowNumber: number, checked: boolean) {
		setSelectedRows((currentRows) => {
			const nextRows = new Set(currentRows);
			if (checked) {
				nextRows.add(rowNumber);
			} else {
				nextRows.delete(rowNumber);
			}
			return nextRows;
		});
	}

	function toggleAllFilteredReadyRows(checked: boolean) {
		setSelectedRows((currentRows) => {
			const nextRows = new Set(currentRows);
			for (const rowNumber of filteredReadyRowNumbers) {
				if (checked) {
					nextRows.add(rowNumber);
				} else {
					nextRows.delete(rowNumber);
				}
			}
			return nextRows;
		});
	}

	async function handleApplyImport() {
		if (!parsedFile || !previewResult) {
			toast.error("Execute a prévia antes de aplicar.");
			return;
		}

		const selectedRowNumbers = Array.from(selectedRows).sort((a, b) => a - b);
		if (selectedRowNumbers.length === 0) {
			toast.error("Selecione ao menos uma linha pronta para aplicar.");
			return;
		}

		let result: Awaited<ReturnType<typeof applyImport.mutateAsync>>;
		try {
			result = await applyImport.mutateAsync({
				fileType: parsedFile.fileType,
				headerSignature: parsedFile.headerSignature,
				templateId: selectedTemplateId || undefined,
				importDate,
				rows: importRows,
				mapping: {
					fields: normalizeMappingForRequest(mapping),
				},
				selectedRowNumbers,
			});
		} catch {
			// error feedback is handled by hook toast
			return;
		}

		setApplyResult(result);
		setStep("RESULT");
	}

	return (
		<main className="w-full space-y-6">
			<PageHeader
				title="Importar Inadimplência"
				description="Importe uma planilha para gerar inadimplências automaticamente por data da venda e campos personalizados."
				actions={
					<Button variant="outline" asChild>
						<Link to="/sales/delinquency">Voltar para inadimplência</Link>
					</Button>
				}
			/>

			<Card className="p-4">
				<div className="flex flex-wrap gap-2">
					{(
						[
							"UPLOAD",
							"MAPPING",
							"IMPORT_DATE",
							"PREVIEW",
							"RESULT",
						] as WizardStep[]
					).map((currentStep) => (
						<Badge
							key={currentStep}
							variant={currentStep === step ? "default" : "outline"}
						>
							{getStepLabel(currentStep)}
						</Badge>
					))}
				</div>
			</Card>

			{step === "UPLOAD" ? (
				<Card className="p-6 space-y-4">
					<div className="flex items-start gap-3">
						<div className="rounded-md bg-muted p-2">
							<FileSpreadsheet className="size-5" />
						</div>
						<div className="space-y-1">
							<p className="font-medium">Envio da planilha</p>
							<p className="text-sm text-muted-foreground">
								Suportado: .xlsx, .xls ou .csv (máx. {MAX_IMPORT_ROWS} linhas)
							</p>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="delinquency-import-file">Arquivo</Label>
						<Input
							id="delinquency-import-file"
							type="file"
							accept=".xlsx,.xls,.csv"
							disabled={isParsingFile}
							onChange={(event) => {
								const file = event.target.files?.[0];
								event.target.value = "";
								if (!file) {
									return;
								}

								void handleSelectFile(file);
							}}
						/>
					</div>

					<Button
						disabled={isParsingFile}
						variant="outline"
						className="w-full sm:w-auto"
					>
						{isParsingFile ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Analisando planilha...
							</>
						) : (
							<>
								<Upload className="size-4" />
								Selecionar planilha
							</>
						)}
					</Button>

					{parsedFile ? (
						<div className="rounded-md border bg-muted/40 p-3 text-sm">
							<p>
								Arquivo: <span className="font-medium">{parsedFile.name}</span>
							</p>
							<p className="text-muted-foreground">
								{parsedFile.rows.length} linhas e {parsedFile.headers.length}{" "}
								colunas
							</p>
						</div>
					) : null}
				</Card>
			) : null}

			{step === "MAPPING" ? (
				<div className="space-y-4">
					<Card className="p-6 space-y-4">
						<div className="space-y-1">
							<p className="font-medium">Template de mapeamento</p>
							<p className="text-sm text-muted-foreground">
								Salve um modelo para reutilizar o mapeamento do mesmo layout.
							</p>
						</div>

						<div className="grid gap-3 lg:grid-cols-3">
							<div className="space-y-2 lg:col-span-2">
								<Label>Modelo salvo</Label>
								<Select
									value={selectedTemplateId || "NONE"}
									onValueChange={(value) => {
										if (value === "NONE") {
											setSelectedTemplateId("");
											setTemplateName("");
											return;
										}

										const template = templates.find(
											(item) => item.id === value,
										);
										if (!template) {
											return;
										}

										applyTemplate(template);
									}}
								>
									<SelectTrigger>
										<SelectValue placeholder="Selecione um modelo" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="NONE">Nenhum modelo</SelectItem>
										{templates.map((template) => (
											<SelectItem key={template.id} value={template.id}>
												{template.name}
												{template.isSuggested ? " (sugerido)" : ""}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label>Nome do modelo</Label>
								<Input
									value={templateName}
									onChange={(event) => setTemplateName(event.target.value)}
									placeholder="Ex.: Cobrança Abril"
								/>
							</div>
						</div>

						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => void handleSaveTemplate()}
								disabled={createTemplate.isPending || updateTemplate.isPending}
							>
								{createTemplate.isPending || updateTemplate.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Save className="size-4" />
								)}
								{selectedTemplateId ? "Atualizar modelo" : "Salvar modelo"}
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={!selectedTemplateId || deleteTemplate.isPending}
								onClick={() => void handleDeleteTemplate()}
							>
								{deleteTemplate.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Trash2 className="size-4" />
								)}
								Excluir modelo
							</Button>
						</div>
					</Card>

					<Card className="p-6 space-y-4">
						<div className="space-y-1">
							<p className="font-medium">Mapeamento da planilha</p>
							<p className="text-sm text-muted-foreground">
								Selecione a coluna da data da venda e os campos personalizados
								de busca.
							</p>
						</div>

						<div className="grid gap-3 md:grid-cols-2">
							<div className="space-y-2">
								<Label>Produto para campos</Label>
								<Select
									value={selectedProductId || "ALL"}
									onValueChange={handleProductSelectionChange}
								>
									<SelectTrigger>
										<SelectValue placeholder="Todos os produtos" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ALL">Todos os produtos</SelectItem>
										{productOptions.map((product) => (
											<SelectItem key={product.id} value={product.id}>
												{product.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									{selectedProductId
										? "Filtrando campos personalizados pelo produto selecionado."
										: "Sem filtro de produto. Mostrando campos de todos os produtos."}
								</p>
							</div>

							<div className="space-y-2">
								<Label>Data da venda (coluna)</Label>
								<Select
									value={mapping.saleDateColumn || "NONE"}
									onValueChange={(value) =>
										setMapping((currentMapping) => ({
											...currentMapping,
											saleDateColumn: value === "NONE" ? "" : value,
										}))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Selecione a coluna" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="NONE">Nenhuma</SelectItem>
										{spreadsheetHeaders.map((header) => (
											<SelectItem key={header} value={header}>
												{header}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<p className="text-sm font-medium">
									Campos personalizados de busca
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={handleAddCustomFieldMapping}
									disabled={availableCustomFieldLabels.length === 0}
								>
									<Plus className="size-4" />
									Adicionar campo
								</Button>
							</div>

							{mapping.customFieldMappings.length === 0 ? (
								<div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
									Nenhum campo mapeado. Adicione pelo menos um campo para
									localizar a venda.
								</div>
							) : (
								<div className="space-y-2">
									{mapping.customFieldMappings.map((customField, index) => (
										<div
											key={`${customField.customFieldLabel}-${index}`}
											className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
										>
											<Select
												value={customField.customFieldLabel || "NONE"}
												onValueChange={(value) =>
													updateCustomFieldMapping(index, {
														customFieldLabel: value === "NONE" ? "" : value,
													})
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="Campo personalizado" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="NONE">Nenhum</SelectItem>
													{availableCustomFieldLabels.map((label) => (
														<SelectItem key={label} value={label}>
															{label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>

											<Select
												value={customField.columnKey || "NONE"}
												onValueChange={(value) =>
													updateCustomFieldMapping(index, {
														columnKey: value === "NONE" ? "" : value,
													})
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="Coluna da planilha" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="NONE">Nenhuma</SelectItem>
													{spreadsheetHeaders.map((header) => (
														<SelectItem key={header} value={header}>
															{header}
														</SelectItem>
													))}
												</SelectContent>
											</Select>

											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() => removeCustomFieldMapping(index)}
											>
												<X className="size-4" />
											</Button>
										</div>
									))}
								</div>
							)}
						</div>

						{searchFieldsQuery.isPending ? (
							<CardSectionSkeleton
								rows={2}
								cardClassName="border-dashed p-3 shadow-none"
							/>
						) : null}
						{productsQuery.isPending ? (
							<CardSectionSkeleton
								rows={2}
								cardClassName="border-dashed p-3 shadow-none"
							/>
						) : null}
					</Card>

					<div className="flex flex-wrap gap-2">
						<Button variant="outline" onClick={() => setStep("UPLOAD")}>
							Voltar
						</Button>
						<Button onClick={handleOpenImportDateStep}>Continuar</Button>
					</div>
				</div>
			) : null}

			{step === "IMPORT_DATE" ? (
				<Card className="p-6 space-y-4">
					<div className="space-y-1">
						<p className="font-medium">Data de importação</p>
						<p className="text-sm text-muted-foreground">
							A inadimplência será criada com vencimento igual à data informada.
						</p>
					</div>

					<div className="max-w-sm space-y-2">
						<Label>Data de importação</Label>
						<CalendarDateInput
							value={importDate}
							onChange={setImportDate}
							maxDate={new Date()}
						/>
					</div>

					<div className="flex flex-wrap gap-2">
						<Button variant="outline" onClick={() => setStep("MAPPING")}>
							Voltar
						</Button>
						<Button
							onClick={() => void handleRunPreview()}
							disabled={previewImport.isPending}
						>
							{previewImport.isPending ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									Gerando prévia...
								</>
							) : (
								"Gerar prévia"
							)}
						</Button>
					</div>
				</Card>
			) : null}

			{step === "PREVIEW" && previewResult ? (
				<div className="space-y-4">
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
						<Card className="p-4">
							<p className="text-xs text-muted-foreground">Total</p>
							<p className="text-lg font-semibold">
								{previewResult.summary.totalRows}
							</p>
						</Card>
						<Card className="p-4">
							<p className="text-xs text-muted-foreground">Prontas</p>
							<p className="text-lg font-semibold text-emerald-700">
								{previewResult.summary.readyRows}
							</p>
						</Card>
						<Card className="p-4">
							<p className="text-xs text-muted-foreground">Sem ação</p>
							<p className="text-lg font-semibold">
								{previewResult.summary.noActionRows}
							</p>
						</Card>
						<Card className="p-4">
							<p className="text-xs text-muted-foreground">Atenção</p>
							<p className="text-lg font-semibold text-amber-700">
								{previewResult.summary.attentionRows}
							</p>
						</Card>
						<Card className="p-4">
							<p className="text-xs text-muted-foreground">Erro</p>
							<p className="text-lg font-semibold text-red-700">
								{previewResult.summary.errorRows}
							</p>
						</Card>
					</div>

					<Card className="p-4 space-y-4">
						<div className="grid gap-3 lg:grid-cols-3">
							<div className="space-y-2">
								<Label>Status</Label>
								<Select
									value={statusFilter}
									onValueChange={(value) =>
										setStatusFilter(value as PreviewStatusFilter)
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Todos" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ALL">Todos</SelectItem>
										<SelectItem value="READY">Pronta</SelectItem>
										<SelectItem value="NO_ACTION">Sem ação</SelectItem>
										<SelectItem value="ATTENTION">Atenção</SelectItem>
										<SelectItem value="ERROR">Erro</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2 lg:col-span-2">
								<Label>Busca</Label>
								<Input
									value={searchTerm}
									onChange={(event) => setSearchTerm(event.target.value)}
									placeholder="Buscar por linha, venda, motivo ou campo personalizado"
								/>
							</div>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
							<div className="flex items-center gap-2">
								<Checkbox
									checked={allFilteredReadySelected}
									onCheckedChange={(checked) =>
										toggleAllFilteredReadyRows(Boolean(checked))
									}
									disabled={filteredReadyRowNumbers.length === 0}
								/>
								<span className="text-sm">
									Selecionar todas as prontas filtradas
								</span>
							</div>
							<p className="text-sm text-muted-foreground">
								{selectedRows.size} linha(s) selecionada(s)
							</p>
						</div>

						<div className="overflow-hidden rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-12">Sel.</TableHead>
										<TableHead>Linha</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Venda</TableHead>
										<TableHead>Data venda</TableHead>
										<TableHead>Vencimento</TableHead>
										<TableHead>Campos</TableHead>
										<TableHead>Motivo</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredPreviewRows.map((row) => {
										const rowSelectable = isSaleDelinquencyPreviewRowReady(row);
										const isSelected = selectedRows.has(row.rowNumber);

										return (
											<TableRow key={row.rowNumber}>
												<TableCell>
													<Checkbox
														checked={isSelected}
														disabled={!rowSelectable}
														onCheckedChange={(checked) =>
															togglePreviewRowSelection(
																row.rowNumber,
																Boolean(checked),
															)
														}
													/>
												</TableCell>
												<TableCell>{row.rowNumber}</TableCell>
												<TableCell>
													<div className="flex flex-wrap items-center gap-2">
														<Badge
															className={STATUS_BADGE_CLASSNAME[row.status]}
														>
															{getStatusLabel(row.status)}
														</Badge>
														{row.isVisualDuplicate ? (
															<Badge variant="outline">Duplicada no lote</Badge>
														) : null}
													</div>
												</TableCell>
												<TableCell className="font-mono text-xs">
													{row.saleId ?? "-"}
												</TableCell>
												<TableCell>{formatDateLabel(row.saleDate)}</TableCell>
												<TableCell>{formatDateLabel(row.dueDate)}</TableCell>
												<TableCell className="max-w-[260px]">
													<div className="space-y-1 text-xs text-muted-foreground">
														{row.customFieldValues.map((fieldValue) => (
															<p
																key={`${row.rowNumber}-${fieldValue.customFieldLabel}`}
															>
																<span className="font-medium text-foreground">
																	{fieldValue.customFieldLabel}:
																</span>{" "}
																{fieldValue.value ?? "-"}
															</p>
														))}
													</div>
												</TableCell>
												<TableCell className="max-w-[380px]">
													<p className="text-sm">{row.reason}</p>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					</Card>

					<div className="flex flex-wrap gap-2">
						<Button variant="outline" onClick={() => setStep("IMPORT_DATE")}>
							Voltar
						</Button>
						<Button
							onClick={() => void handleApplyImport()}
							disabled={applyImport.isPending || selectedRows.size === 0}
						>
							{applyImport.isPending ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									Aplicando...
								</>
							) : (
								<>
									<CheckCircle2 className="size-4" />
									Aplicar importação
								</>
							)}
						</Button>
					</div>
				</div>
			) : null}

			{step === "RESULT" && applyResult ? (
				<div className="space-y-4">
					<div className="grid gap-3 sm:grid-cols-3">
						<Card className="p-4">
							<p className="text-xs text-muted-foreground">Solicitadas</p>
							<p className="text-lg font-semibold">{applyResult.requested}</p>
						</Card>
						<Card className="p-4">
							<p className="text-xs text-muted-foreground">Aplicadas</p>
							<p className="text-lg font-semibold text-emerald-700">
								{applyResult.applied}
							</p>
						</Card>
						<Card className="p-4">
							<p className="text-xs text-muted-foreground">Ignoradas</p>
							<p className="text-lg font-semibold">{applyResult.skipped}</p>
						</Card>
					</div>

					<Card className="p-4 space-y-3">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<AlertCircle className="size-4" />A aplicação revalida cada linha
							no momento da confirmação para evitar conflitos.
						</div>

						<div className="overflow-hidden rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Linha</TableHead>
										<TableHead>Resultado</TableHead>
										<TableHead>Venda</TableHead>
										<TableHead>Data venda</TableHead>
										<TableHead>Vencimento</TableHead>
										<TableHead>Campos</TableHead>
										<TableHead>Motivo</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{resultRows.map((row) => (
										<TableRow key={`${row.rowNumber}-${row.result}`}>
											<TableCell>{row.rowNumber}</TableCell>
											<TableCell>
												<Badge className={getResultBadgeClass(row.result)}>
													{getResultLabel(row.result)}
												</Badge>
											</TableCell>
											<TableCell className="font-mono text-xs">
												{row.saleId ?? "-"}
											</TableCell>
											<TableCell>{formatDateLabel(row.saleDate)}</TableCell>
											<TableCell>{formatDateLabel(row.dueDate)}</TableCell>
											<TableCell className="max-w-[260px] text-xs text-muted-foreground">
												{row.customFieldSummary}
											</TableCell>
											<TableCell>{row.reason}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</Card>

					<div className="flex flex-wrap gap-2">
						<Button variant="outline" onClick={resetWizard}>
							Nova importação
						</Button>
						<Button asChild>
							<Link to="/sales/delinquency">Ver inadimplência</Link>
						</Button>
					</div>
				</div>
			) : null}
		</main>
	);
}
