import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
	CheckCircle2,
	FileSpreadsheet,
	Info,
	Loader2,
	Save,
	Trash2,
	Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
	useApplyCommissionReceiptImport,
	useCommissionReceiptImportTemplates,
	useCreateCommissionReceiptImportTemplate,
	useDeleteCommissionReceiptImportTemplate,
	usePreviewCommissionReceiptImport,
	useUpdateCommissionReceiptImportTemplate,
} from "@/hooks/commissions";
import {
	type ParsedImportFile,
	parseSpreadsheetFile,
} from "@/pages/_app/sales/-components/import-sales/utils";
import type {
	CommissionReceiptImportApplyResult,
	CommissionReceiptImportPreviewResult,
	CommissionReceiptImportPreviewRow,
	CommissionReceiptImportTemplate,
	CommissionReceiptImportTemplateFields,
} from "@/schemas/types/commission-receipt-import";
import { formatCurrencyBRL } from "@/utils/format-amount";
import {
	buildCommissionReceiptImportResultRows,
	buildSuggestedCommissionReceiptImportMapping,
	isCommissionReceiptPreviewRowReady,
	parseInstallmentReferenceNumber,
	shouldAutoSelectCommissionReceiptPreviewRow,
} from "./commission-receipt-import-helpers";

const STATUS_BADGE_CLASSNAME: Record<
	CommissionReceiptImportPreviewRow["status"],
	string
> = {
	READY: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
	NO_ACTION: "bg-slate-500/15 text-slate-700 border-slate-500/30",
	ATTENTION: "bg-amber-500/15 text-amber-700 border-amber-500/30",
	ERROR: "bg-red-500/15 text-red-700 border-red-500/30",
};
const INSTALLMENT_STATUS_BADGE_CLASSNAME = {
	PENDING: "bg-amber-500/15 text-amber-700 border-amber-500/30",
	PAID: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
	CANCELED: "bg-slate-500/15 text-slate-700 border-slate-500/30",
} as const;

type WizardStep = "UPLOAD" | "MAPPING" | "PREVIEW" | "RESULT";
type PreviewStatusFilter =
	| "ALL"
	| "READY"
	| "NO_ACTION"
	| "ATTENTION"
	| "ERROR"
	| "SYSTEM_PENDING"
	| "SYSTEM_PAID"
	| "SYSTEM_CANCELED";
type EditingRowValues = {
	saleDate: string;
	group: string;
	quota: string;
	installment: string;
	receivedAmount: string;
};

interface CommissionReceiptImportWizardProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const EMPTY_MAPPING: CommissionReceiptImportTemplateFields = {
	saleDateColumn: "",
	groupColumn: "",
	quotaColumn: "",
	installmentColumn: "",
	receivedAmountColumn: "",
};

function getDefaultImportDate() {
	return format(new Date(), "yyyy-MM-dd");
}

function buildTemplatePayload(params: {
	name: string;
	headerSignature: string;
	mapping: CommissionReceiptImportTemplateFields;
}) {
	return {
		name: params.name,
		headerSignature: params.headerSignature,
		mapping: {
			fields: params.mapping,
		},
	};
}

function getPreviewStatusLabel(
	status: CommissionReceiptImportPreviewRow["status"],
) {
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

function getInstallmentStatusLabel(
	status: CommissionReceiptImportPreviewRow["installmentStatus"],
) {
	if (status === "PENDING") {
		return "Pendente";
	}

	if (status === "PAID") {
		return "Paga";
	}

	if (status === "CANCELED") {
		return "Cancelada";
	}

	return "-";
}

function getInstallmentStatusBadgeClass(
	status: CommissionReceiptImportPreviewRow["installmentStatus"],
) {
	if (!status) {
		return "bg-muted text-muted-foreground border-border";
	}

	return INSTALLMENT_STATUS_BADGE_CLASSNAME[status];
}

function getStatusFilterLabel(value: PreviewStatusFilter) {
	if (value === "ALL") {
		return "Todos";
	}

	if (value === "READY") {
		return "Pronta";
	}

	if (value === "NO_ACTION") {
		return "Sem ação";
	}

	if (value === "ATTENTION") {
		return "Atenção";
	}

	if (value === "ERROR") {
		return "Erro";
	}

	if (value === "SYSTEM_PENDING") {
		return "Sistema: Pendente";
	}

	if (value === "SYSTEM_PAID") {
		return "Sistema: Paga";
	}

	return "Sistema: Cancelada";
}

function matchesStatusFilter(
	row: CommissionReceiptImportPreviewRow,
	filter: PreviewStatusFilter,
) {
	if (filter === "ALL") {
		return true;
	}

	if (filter === "SYSTEM_PENDING") {
		return row.installmentStatus === "PENDING";
	}

	if (filter === "SYSTEM_PAID") {
		return row.installmentStatus === "PAID";
	}

	if (filter === "SYSTEM_CANCELED") {
		return row.installmentStatus === "CANCELED";
	}

	return row.status === filter;
}

function getStepLabel(step: WizardStep) {
	if (step === "UPLOAD") {
		return "1. Upload e análise";
	}

	if (step === "MAPPING") {
		return "2. Mapeamento e template";
	}

	if (step === "PREVIEW") {
		return "3. Prévia";
	}

	return "4. Resultado";
}

function validateMapping(mapping: CommissionReceiptImportTemplateFields) {
	if (!mapping.saleDateColumn) {
		return "Selecione a coluna de data da venda.";
	}

	if (!mapping.groupColumn) {
		return "Selecione a coluna de grupo.";
	}

	if (!mapping.quotaColumn) {
		return "Selecione a coluna de cota.";
	}

	if (!mapping.installmentColumn) {
		return "Selecione a coluna de parcela.";
	}

	if (!mapping.receivedAmountColumn) {
		return "Selecione a coluna de valor recebido.";
	}

	const selectedColumns = [
		mapping.saleDateColumn,
		mapping.groupColumn,
		mapping.quotaColumn,
		mapping.installmentColumn,
		mapping.receivedAmountColumn,
	];

	const uniqueColumns = new Set(selectedColumns);
	if (uniqueColumns.size !== selectedColumns.length) {
		return "Cada campo deve usar uma coluna diferente.";
	}

	return null;
}

function getResultBadgeClass(result: "APPLIED" | "SKIPPED") {
	return result === "APPLIED"
		? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
		: "bg-slate-500/15 text-slate-700 border-slate-500/30";
}

function getResultLabel(result: "APPLIED" | "SKIPPED") {
	return result === "APPLIED" ? "Aplicada" : "Ignorada";
}

function normalizeEditableCellValue(value: unknown) {
	if (value === null || value === undefined) {
		return "";
	}

	if (value instanceof Date) {
		return format(value, "yyyy-MM-dd");
	}

	return String(value);
}

export function CommissionReceiptImportWizard({
	open,
	onOpenChange,
}: CommissionReceiptImportWizardProps) {
	const [step, setStep] = useState<WizardStep>("UPLOAD");
	const [parsedFile, setParsedFile] = useState<ParsedImportFile | null>(null);
	const [importRows, setImportRows] = useState<Array<Record<string, unknown>>>(
		[],
	);
	const [mapping, setMapping] =
		useState<CommissionReceiptImportTemplateFields>(EMPTY_MAPPING);
	const [importDate, setImportDate] = useState(getDefaultImportDate());
	const [selectedTemplateId, setSelectedTemplateId] = useState("");
	const [templateName, setTemplateName] = useState("");
	const [previewResult, setPreviewResult] =
		useState<CommissionReceiptImportPreviewResult | null>(null);
	const [applyResult, setApplyResult] =
		useState<CommissionReceiptImportApplyResult | null>(null);
	const [statusFilter, setStatusFilter] = useState<PreviewStatusFilter>("ALL");
	const [searchTerm, setSearchTerm] = useState("");
	const [editingRowNumber, setEditingRowNumber] = useState<number | null>(null);
	const [editingRowValues, setEditingRowValues] =
		useState<EditingRowValues | null>(null);
	const [selectedRows, setSelectedRows] = useState(() => new Set<number>());
	const [isParsingFile, setIsParsingFile] = useState(false);

	const templatesQuery = useCommissionReceiptImportTemplates({
		headerSignature: parsedFile?.headerSignature,
		enabled: open && Boolean(parsedFile?.headerSignature),
	});
	const createTemplate = useCreateCommissionReceiptImportTemplate();
	const updateTemplate = useUpdateCommissionReceiptImportTemplate();
	const deleteTemplate = useDeleteCommissionReceiptImportTemplate();
	const previewImport = usePreviewCommissionReceiptImport();
	const applyImport = useApplyCommissionReceiptImport();

	const templates = templatesQuery.data?.templates ?? [];

	const filteredPreviewRows = useMemo(() => {
		if (!previewResult) {
			return [];
		}

		const normalizedSearchTerm = searchTerm
			.normalize("NFD")
			.replace(/\p{Diacritic}/gu, "")
			.toLowerCase()
			.trim();

		return previewResult.rows.filter((row) => {
			if (!matchesStatusFilter(row, statusFilter)) {
				return false;
			}

			if (!normalizedSearchTerm) {
				return true;
			}

			const searchableParts = [
				String(row.rowNumber),
				row.saleDate ?? "",
				row.groupValue ?? "",
				row.quotaValue ?? "",
				row.installmentText ?? "",
				getPreviewStatusLabel(row.status),
				getInstallmentStatusLabel(row.installmentStatus),
				row.reason ?? "",
			];

			const normalizedRowContent = searchableParts
				.join(" ")
				.normalize("NFD")
				.replace(/\p{Diacritic}/gu, "")
				.toLowerCase();

			return normalizedRowContent.includes(normalizedSearchTerm);
		});
	}, [previewResult, statusFilter, searchTerm]);

	const filteredReadyRowNumbers = useMemo(() => {
		return filteredPreviewRows
			.filter((row) => isCommissionReceiptPreviewRowReady(row))
			.map((row) => row.rowNumber);
	}, [filteredPreviewRows]);

	useEffect(() => {
		if (!open) {
			setStep("UPLOAD");
			setParsedFile(null);
			setImportRows([]);
			setMapping(EMPTY_MAPPING);
			setImportDate(getDefaultImportDate());
			setSelectedTemplateId("");
			setTemplateName("");
			setPreviewResult(null);
			setApplyResult(null);
			setStatusFilter("ALL");
			setSearchTerm("");
			setEditingRowNumber(null);
			setEditingRowValues(null);
			setSelectedRows(new Set<number>());
			setIsParsingFile(false);
		}
	}, [open]);

	useEffect(() => {
		if (!open || !parsedFile || step !== "MAPPING") {
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

		setSelectedTemplateId(suggestedTemplate.id);
		setTemplateName(suggestedTemplate.name);
		setMapping(suggestedTemplate.mapping.fields);
	}, [open, parsedFile, step, templates, selectedTemplateId]);

	function applyTemplate(template: CommissionReceiptImportTemplate) {
		setSelectedTemplateId(template.id);
		setTemplateName(template.name);
		setMapping(template.mapping.fields);
	}

	async function handleSelectFile(file: File) {
		setIsParsingFile(true);
		try {
			const nextParsedFile = await parseSpreadsheetFile(file);
			setParsedFile(nextParsedFile);
			setImportRows(nextParsedFile.rows);
			setMapping(
				buildSuggestedCommissionReceiptImportMapping(nextParsedFile.headers),
			);
			setPreviewResult(null);
			setApplyResult(null);
			setEditingRowNumber(null);
			setEditingRowValues(null);
			setSelectedRows(new Set<number>());
			setSelectedTemplateId("");
			setTemplateName("");
			setStep("MAPPING");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Arquivo inválido.";
			toast.error(message);
		} finally {
			setIsParsingFile(false);
		}
	}

	async function runPreviewWithRows(rows: Array<Record<string, unknown>>) {
		if (!parsedFile) {
			return false;
		}

		const preview = await previewImport.mutateAsync({
			fileType: parsedFile.fileType,
			headerSignature: parsedFile.headerSignature,
			templateId: selectedTemplateId || undefined,
			importDate,
			rows,
			mapping: {
				fields: mapping,
			},
		});

		setPreviewResult(preview);
		setApplyResult(null);
		setStatusFilter("ALL");
		setSearchTerm("");
		setSelectedRows(
			new Set(
				preview.rows
					.filter((row) => shouldAutoSelectCommissionReceiptPreviewRow(row))
					.map((row) => row.rowNumber),
			),
		);
		setStep("PREVIEW");
		return true;
	}

	async function handleRunPreview() {
		if (!parsedFile) {
			toast.error("Envie uma planilha para continuar.");
			return;
		}

		const mappingError = validateMapping(mapping);
		if (mappingError) {
			toast.error(mappingError);
			return;
		}

		if (!importDate) {
			toast.error("Informe a data da importação.");
			return;
		}

		await runPreviewWithRows(importRows);
	}

	async function handleApplySelectedRows() {
		if (!parsedFile || !previewResult) {
			return;
		}

		const selectedReadyRows = Array.from(selectedRows).filter((rowNumber) => {
			const row = previewResult.rows.find(
				(previewRow) => previewRow.rowNumber === rowNumber,
			);
			return Boolean(row && isCommissionReceiptPreviewRowReady(row));
		});

		if (selectedReadyRows.length === 0) {
			toast.error("Selecione ao menos uma linha pronta para aplicar.");
			return;
		}

		const result = await applyImport.mutateAsync({
			fileType: parsedFile.fileType,
			headerSignature: parsedFile.headerSignature,
			templateId: selectedTemplateId || undefined,
			importDate,
			rows: importRows,
			mapping: {
				fields: mapping,
			},
			selectedRowNumbers: selectedReadyRows,
		});

		setApplyResult(result);
		setStep("RESULT");
	}

	async function handleSaveTemplate() {
		if (!parsedFile) {
			return;
		}

		const mappingError = validateMapping(mapping);
		if (mappingError) {
			toast.error(mappingError);
			return;
		}

		const normalizedTemplateName = templateName.trim();
		if (!normalizedTemplateName) {
			toast.error("Informe um nome para o modelo.");
			return;
		}

		if (selectedTemplateId) {
			await updateTemplate.mutateAsync({
				templateId: selectedTemplateId,
				data: buildTemplatePayload({
					name: normalizedTemplateName,
					headerSignature: parsedFile.headerSignature,
					mapping,
				}),
			});
		} else {
			const created = await createTemplate.mutateAsync(
				buildTemplatePayload({
					name: normalizedTemplateName,
					headerSignature: parsedFile.headerSignature,
					mapping,
				}),
			);
			setSelectedTemplateId(created.templateId);
		}

		await templatesQuery.refetch();
		setTemplateName(normalizedTemplateName);
	}

	async function handleDeleteTemplate() {
		if (!selectedTemplateId) {
			return;
		}

		await deleteTemplate.mutateAsync(selectedTemplateId);
		setSelectedTemplateId("");
		setTemplateName("");
		await templatesQuery.refetch();
	}

	function toggleReadyRowSelection(row: CommissionReceiptImportPreviewRow) {
		if (!isCommissionReceiptPreviewRowReady(row)) {
			return;
		}

		setSelectedRows((currentSelectedRows) => {
			const nextSelection = new Set(currentSelectedRows);
			if (nextSelection.has(row.rowNumber)) {
				nextSelection.delete(row.rowNumber);
			} else {
				nextSelection.add(row.rowNumber);
			}

			return nextSelection;
		});
	}

	function toggleAllReadyRows(checked: boolean) {
		if (!filteredReadyRowNumbers.length) {
			return;
		}

		if (checked) {
			setSelectedRows((currentSelectedRows) => {
				const nextSelection = new Set(currentSelectedRows);
				for (const rowNumber of filteredReadyRowNumbers) {
					nextSelection.add(rowNumber);
				}
				return nextSelection;
			});
			return;
		}

		setSelectedRows((currentSelectedRows) => {
			const nextSelection = new Set(currentSelectedRows);
			for (const rowNumber of filteredReadyRowNumbers) {
				nextSelection.delete(rowNumber);
			}
			return nextSelection;
		});
	}

	function closeEditRowDialog() {
		setEditingRowNumber(null);
		setEditingRowValues(null);
	}

	function updateEditingRowValue(field: keyof EditingRowValues, value: string) {
		setEditingRowValues((currentValues) =>
			currentValues
				? {
						...currentValues,
						[field]: value,
					}
				: currentValues,
		);
	}

	function openEditRowDialog(row: CommissionReceiptImportPreviewRow) {
		const rowIndex = row.rowNumber - 1;
		const sourceRow = importRows[rowIndex];
		if (!sourceRow) {
			toast.error("Linha não encontrada para edição.");
			return;
		}

		setEditingRowNumber(row.rowNumber);
		setEditingRowValues({
			saleDate: normalizeEditableCellValue(sourceRow[mapping.saleDateColumn]),
			group: normalizeEditableCellValue(sourceRow[mapping.groupColumn]),
			quota: normalizeEditableCellValue(sourceRow[mapping.quotaColumn]),
			installment: normalizeEditableCellValue(
				sourceRow[mapping.installmentColumn],
			),
			receivedAmount: normalizeEditableCellValue(
				sourceRow[mapping.receivedAmountColumn],
			),
		});
	}

	async function handleSaveEditedRow() {
		if (editingRowNumber === null || !editingRowValues) {
			return;
		}

		const rowIndex = editingRowNumber - 1;
		const sourceRow = importRows[rowIndex];
		if (!sourceRow) {
			toast.error("Linha não encontrada para edição.");
			return;
		}

		const nextRows = [...importRows];
		nextRows[rowIndex] = {
			...sourceRow,
			[mapping.saleDateColumn]: editingRowValues.saleDate,
			[mapping.groupColumn]: editingRowValues.group,
			[mapping.quotaColumn]: editingRowValues.quota,
			[mapping.installmentColumn]: editingRowValues.installment,
			[mapping.receivedAmountColumn]: editingRowValues.receivedAmount,
		};

		setImportRows(nextRows);
		const isPreviewUpdated = await runPreviewWithRows(nextRows);
		if (!isPreviewUpdated) {
			return;
		}

		closeEditRowDialog();
		toast.success(
			"Edição aplicada na prévia. A atualização no sistema só ocorre na confirmação.",
		);
	}

	const canProceedToPreview = Boolean(parsedFile);
	const mappingError = validateMapping(mapping);
	const selectedReadyRowsCount = Array.from(selectedRows).filter(
		(rowNumber) => {
			if (!previewResult) {
				return false;
			}

			const previewRow = previewResult.rows.find(
				(row) => row.rowNumber === rowNumber,
			);
			return Boolean(
				previewRow && isCommissionReceiptPreviewRowReady(previewRow),
			);
		},
	).length;

	const isAllReadyRowsSelected =
		filteredReadyRowNumbers.length > 0 &&
		filteredReadyRowNumbers.every((rowNumber) => selectedRows.has(rowNumber));
	const resultRows = useMemo(() => {
		if (!applyResult) {
			return [];
		}

		return buildCommissionReceiptImportResultRows({
			previewRows: previewResult?.rows ?? [],
			applyRows: applyResult.results,
			importDate,
		});
	}, [applyResult, importDate, previewResult]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-[95vw] xl:max-w-[1500px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FileSpreadsheet className="size-4" />
						Importar recebimentos de comissões
					</DialogTitle>
					<DialogDescription>
						Fluxo separado para conciliar planilha da administradora e aplicar
						pagamentos apenas em parcelas INCOME.
					</DialogDescription>
				</DialogHeader>

				<div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
					{getStepLabel(step)}
				</div>

				{step === "UPLOAD" ? (
					<div className="space-y-4">
						<Card className="space-y-3 p-4">
							<div className="flex items-start gap-3 text-sm text-muted-foreground">
								<Info className="mt-0.5 size-4" />
								<div>
									<p>
										Campos esperados na planilha: data da venda, grupo, cota,
										parcela e valor_recebimento.
									</p>
									<p>
										A data da importação será informada manualmente na próxima
										etapa.
									</p>
								</div>
							</div>

							<div className="space-y-2">
								<label
									htmlFor="commission-receipt-import-file"
									className="text-sm font-medium"
								>
									Planilha (.xlsx, .xls ou .csv)
								</label>
								<Input
									id="commission-receipt-import-file"
									type="file"
									accept=".xlsx,.xls,.csv"
									disabled={isParsingFile}
									onChange={async (event) => {
										const nextFile = event.target.files?.[0];
										if (!nextFile) {
											return;
										}

										await handleSelectFile(nextFile);
										event.target.value = "";
									}}
								/>
							</div>
						</Card>
					</div>
				) : null}

				{step === "MAPPING" && parsedFile ? (
					<div className="space-y-4">
						<Card className="space-y-4 p-4">
							<div className="grid gap-3 sm:grid-cols-2">
								<div>
									<p className="text-sm font-medium">Arquivo</p>
									<p className="text-sm text-muted-foreground">
										{parsedFile.name}
									</p>
								</div>
								<div>
									<p className="text-sm font-medium">Linhas detectadas</p>
									<p className="text-sm text-muted-foreground">
										{parsedFile.rows.length}
									</p>
								</div>
							</div>

							<div className="space-y-2">
								<p className="text-sm font-medium">Data da importação *</p>
								<CalendarDateInput
									value={importDate}
									onChange={setImportDate}
									locale={ptBR}
								/>
								<p className="text-xs text-muted-foreground">
									A data da importação será usada como `paymentDate` ao aplicar.
									O filtro de venda por `saleDate` usa a coluna de data mapeada
									da planilha.
								</p>
							</div>
						</Card>

						<Card className="space-y-3 p-4">
							<h3 className="text-sm font-semibold">Modelos</h3>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-2">
									<p className="text-sm font-medium">Selecionar modelo</p>
									<Select
										value={selectedTemplateId || "__none__"}
										onValueChange={(value) => {
											if (value === "__none__") {
												setSelectedTemplateId("");
												setTemplateName("");
												return;
											}

											const template = templates.find(
												(item) => item.id === value,
											);
											if (template) {
												applyTemplate(template);
											}
										}}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione um modelo" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__none__">Sem modelo</SelectItem>
											{templates.map((template) => (
												<SelectItem key={template.id} value={template.id}>
													{template.name}
													{template.isSuggested ? " (Sugerido)" : ""}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<p className="text-sm font-medium">Nome do modelo</p>
									<Input
										value={templateName}
										onChange={(event) => setTemplateName(event.target.value)}
										placeholder="Ex.: Administradora Março"
									/>
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={() => void handleSaveTemplate()}
											disabled={
												createTemplate.isPending ||
												updateTemplate.isPending ||
												Boolean(mappingError)
											}
										>
											{createTemplate.isPending || updateTemplate.isPending ? (
												<Loader2 className="size-4 animate-spin" />
											) : (
												<Save className="size-4" />
											)}
											{selectedTemplateId ? "Atualizar" : "Salvar"}
										</Button>

										<Button
											type="button"
											variant="ghost"
											onClick={() => void handleDeleteTemplate()}
											disabled={!selectedTemplateId || deleteTemplate.isPending}
										>
											{deleteTemplate.isPending ? (
												<Loader2 className="size-4 animate-spin" />
											) : (
												<Trash2 className="size-4" />
											)}
											Excluir
										</Button>
									</div>
								</div>
							</div>
						</Card>

						<Card className="space-y-3 p-4">
							<h3 className="text-sm font-semibold">Mapeamento de colunas</h3>
							<div className="grid gap-3 md:grid-cols-2">
								<div className="space-y-1">
									<p className="text-sm font-medium">Data da venda *</p>
									<Select
										value={mapping.saleDateColumn}
										onValueChange={(value) =>
											setMapping((previous) => ({
												...previous,
												saleDateColumn: value,
											}))
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione a coluna" />
										</SelectTrigger>
										<SelectContent>
											{parsedFile.headers.map((header) => (
												<SelectItem key={header} value={header}>
													{header}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<p className="text-sm font-medium">Grupo *</p>
									<Select
										value={mapping.groupColumn}
										onValueChange={(value) =>
											setMapping((previous) => ({
												...previous,
												groupColumn: value,
											}))
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione a coluna" />
										</SelectTrigger>
										<SelectContent>
											{parsedFile.headers.map((header) => (
												<SelectItem key={header} value={header}>
													{header}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<p className="text-sm font-medium">Cota *</p>
									<Select
										value={mapping.quotaColumn}
										onValueChange={(value) =>
											setMapping((previous) => ({
												...previous,
												quotaColumn: value,
											}))
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione a coluna" />
										</SelectTrigger>
										<SelectContent>
											{parsedFile.headers.map((header) => (
												<SelectItem key={header} value={header}>
													{header}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<p className="text-sm font-medium">Parcela *</p>
									<Select
										value={mapping.installmentColumn}
										onValueChange={(value) =>
											setMapping((previous) => ({
												...previous,
												installmentColumn: value,
											}))
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione a coluna" />
										</SelectTrigger>
										<SelectContent>
											{parsedFile.headers.map((header) => (
												<SelectItem key={header} value={header}>
													{header}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1">
									<p className="text-sm font-medium">Valor de recebimento *</p>
									<Select
										value={mapping.receivedAmountColumn}
										onValueChange={(value) =>
											setMapping((previous) => ({
												...previous,
												receivedAmountColumn: value,
											}))
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione a coluna" />
										</SelectTrigger>
										<SelectContent>
											{parsedFile.headers.map((header) => (
												<SelectItem key={header} value={header}>
													{header}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							{mappingError ? (
								<p className="text-sm text-destructive">{mappingError}</p>
							) : null}
						</Card>
					</div>
				) : null}

				{step === "PREVIEW" && previewResult ? (
					<div className="space-y-4">
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
							<Card className="p-3">
								<p className="text-xs text-muted-foreground">Total</p>
								<p className="text-lg font-semibold">
									{previewResult.summary.totalRows}
								</p>
							</Card>
							<Card className="p-3">
								<p className="text-xs text-muted-foreground">Prontas</p>
								<p className="text-lg font-semibold text-emerald-700">
									{previewResult.summary.readyRows}
								</p>
							</Card>
							<Card className="p-3">
								<p className="text-xs text-muted-foreground">Sem ação</p>
								<p className="text-lg font-semibold text-slate-700">
									{previewResult.summary.noActionRows}
								</p>
							</Card>
							<Card className="p-3">
								<p className="text-xs text-muted-foreground">Atenção</p>
								<p className="text-lg font-semibold text-amber-700">
									{previewResult.summary.attentionRows}
								</p>
							</Card>
							<Card className="p-3">
								<p className="text-xs text-muted-foreground">Erros</p>
								<p className="text-lg font-semibold text-red-700">
									{previewResult.summary.errorRows}
								</p>
							</Card>
						</div>

						<Card className="space-y-3 p-4">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="text-sm font-medium">Linhas da prévia</p>
									<p className="text-xs text-muted-foreground">
										Mostrando {filteredPreviewRows.length} de{" "}
										{previewResult.rows.length} linhas.
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-3">
									<div className="min-w-72 space-y-1">
										<p className="text-xs text-muted-foreground">Busca</p>
										<Input
											value={searchTerm}
											onChange={(event) => setSearchTerm(event.target.value)}
											placeholder="Buscar por linha, grupo, cota, parcela, status..."
											className="h-8"
										/>
									</div>

									<div className="min-w-56 space-y-1">
										<p className="text-xs text-muted-foreground">
											Filtro de status
										</p>
										<Select
											value={statusFilter}
											onValueChange={(value) =>
												setStatusFilter(value as PreviewStatusFilter)
											}
										>
											<SelectTrigger className="h-8">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{(
													[
														"ALL",
														"READY",
														"NO_ACTION",
														"ATTENTION",
														"ERROR",
														"SYSTEM_PENDING",
														"SYSTEM_PAID",
														"SYSTEM_CANCELED",
													] as const
												).map((value) => (
													<SelectItem key={value} value={value}>
														{getStatusFilterLabel(value)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="flex items-center gap-2 text-sm">
										<Checkbox
											checked={isAllReadyRowsSelected}
											onCheckedChange={(checked) =>
												toggleAllReadyRows(checked === true)
											}
										/>
										<span>Selecionar prontas visíveis</span>
									</div>
								</div>
							</div>

							<div className="max-h-[420px] overflow-auto rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-10">Sel.</TableHead>
											<TableHead>Linha</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Grupo / Cota</TableHead>
											<TableHead>Parcela</TableHead>
											<TableHead>Valor recebido</TableHead>
											<TableHead>Status sistema</TableHead>
											<TableHead>Valor sistema</TableHead>
											<TableHead>Motivo</TableHead>
											<TableHead className="w-24">Ações</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredPreviewRows.map((row) => {
											const isReady = isCommissionReceiptPreviewRowReady(row);
											const parsedInstallmentNumber =
												parseInstallmentReferenceNumber(row.installmentText);

											return (
												<TableRow key={row.rowNumber}>
													<TableCell>
														<Checkbox
															checked={selectedRows.has(row.rowNumber)}
															disabled={!isReady}
															onCheckedChange={() =>
																toggleReadyRowSelection(row)
															}
														/>
													</TableCell>
													<TableCell>{row.rowNumber}</TableCell>
													<TableCell>
														<Badge
															variant="outline"
															className={STATUS_BADGE_CLASSNAME[row.status]}
														>
															{getPreviewStatusLabel(row.status)}
														</Badge>
													</TableCell>
													<TableCell>
														<div className="text-xs">
															<p className="text-muted-foreground">
																{row.saleDate ?? "-"}
															</p>
															<p className="font-medium">
																{row.groupValue ?? "-"}
															</p>
															<p className="text-muted-foreground">
																{row.quotaValue ?? "-"}
															</p>
														</div>
													</TableCell>
													<TableCell>
														<div className="text-xs">
															<p>{row.installmentText ?? "-"}</p>
															<p className="text-muted-foreground">
																{parsedInstallmentNumber
																	? `Nº ${parsedInstallmentNumber}`
																	: "-"}
															</p>
														</div>
													</TableCell>
													<TableCell>
														{row.receivedAmount === null
															? "-"
															: formatCurrencyBRL(row.receivedAmount / 100)}
													</TableCell>
													<TableCell>
														<Badge
															variant="outline"
															className={getInstallmentStatusBadgeClass(
																row.installmentStatus,
															)}
														>
															{getInstallmentStatusLabel(row.installmentStatus)}
														</Badge>
													</TableCell>
													<TableCell>
														{row.installmentAmount === null
															? "-"
															: formatCurrencyBRL(row.installmentAmount / 100)}
													</TableCell>
													<TableCell className="min-w-72 text-xs text-muted-foreground">
														{row.reason}
													</TableCell>
													<TableCell>
														<Button
															type="button"
															variant="outline"
															size="sm"
															className="h-7"
															onClick={() => openEditRowDialog(row)}
															disabled={
																previewImport.isPending || applyImport.isPending
															}
														>
															Editar
														</Button>
													</TableCell>
												</TableRow>
											);
										})}
										{filteredPreviewRows.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={10}
													className="py-6 text-center text-sm text-muted-foreground"
												>
													Nenhuma linha encontrada para o filtro selecionado.
												</TableCell>
											</TableRow>
										) : null}
									</TableBody>
								</Table>
							</div>
						</Card>
					</div>
				) : null}

				{step === "RESULT" && applyResult ? (
					<div className="space-y-4">
						<div className="grid gap-3 sm:grid-cols-3">
							<Card className="p-3">
								<p className="text-xs text-muted-foreground">Solicitadas</p>
								<p className="text-lg font-semibold">{applyResult.requested}</p>
							</Card>
							<Card className="p-3">
								<p className="text-xs text-muted-foreground">Aplicadas</p>
								<p className="text-lg font-semibold text-emerald-700">
									{applyResult.applied}
								</p>
							</Card>
							<Card className="p-3">
								<p className="text-xs text-muted-foreground">Ignoradas</p>
								<p className="text-lg font-semibold text-slate-700">
									{applyResult.skipped}
								</p>
							</Card>
						</div>

						<Card className="max-h-[420px] overflow-auto p-0">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Linha</TableHead>
										<TableHead>Data venda</TableHead>
										<TableHead>Grupo</TableHead>
										<TableHead>Cota</TableHead>
										<TableHead>Parcela</TableHead>
										<TableHead>Resultado</TableHead>
										<TableHead>Status sistema (antes)</TableHead>
										<TableHead>Status sistema (depois)</TableHead>
										<TableHead>Valor sistema (antes)</TableHead>
										<TableHead>Valor sistema (depois)</TableHead>
										<TableHead>Data pagamento (aplicada)</TableHead>
										<TableHead>Motivo</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{resultRows.map((row) => {
										const parsedInstallmentNumber =
											parseInstallmentReferenceNumber(row.installmentText);

										return (
											<TableRow key={`${row.rowNumber}-${row.result}`}>
												<TableCell>{row.rowNumber}</TableCell>
												<TableCell>{row.saleDate ?? "-"}</TableCell>
												<TableCell>{row.groupValue ?? "-"}</TableCell>
												<TableCell>{row.quotaValue ?? "-"}</TableCell>
												<TableCell>
													<div className="text-xs">
														<p>{row.installmentText ?? "-"}</p>
														<p className="text-muted-foreground">
															{parsedInstallmentNumber
																? `Nº ${parsedInstallmentNumber}`
																: "-"}
														</p>
													</div>
												</TableCell>
												<TableCell>
													<Badge
														variant="outline"
														className={getResultBadgeClass(row.result)}
													>
														{getResultLabel(row.result)}
													</Badge>
												</TableCell>
												<TableCell>
													<Badge
														variant="outline"
														className={getInstallmentStatusBadgeClass(
															row.beforeStatus,
														)}
													>
														{getInstallmentStatusLabel(row.beforeStatus)}
													</Badge>
												</TableCell>
												<TableCell>
													<Badge
														variant="outline"
														className={`${getInstallmentStatusBadgeClass(
															row.afterStatus,
														)} ${row.statusChanged ? "ring-1 ring-emerald-400/60" : ""}`}
													>
														{getInstallmentStatusLabel(row.afterStatus)}
													</Badge>
												</TableCell>
												<TableCell className="text-muted-foreground">
													{row.beforeAmount === null
														? "-"
														: formatCurrencyBRL(row.beforeAmount / 100)}
												</TableCell>
												<TableCell
													className={
														row.amountChanged
															? "font-semibold text-emerald-700"
															: ""
													}
												>
													{row.afterAmount === null
														? "-"
														: formatCurrencyBRL(row.afterAmount / 100)}
												</TableCell>
												<TableCell>{row.appliedPaymentDate ?? "-"}</TableCell>
												<TableCell className="min-w-72 text-xs text-muted-foreground">
													{row.reason}
												</TableCell>
											</TableRow>
										);
									})}
									{resultRows.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={12}
												className="py-6 text-center text-sm text-muted-foreground"
											>
												Nenhuma linha selecionada para exibir no resultado.
											</TableCell>
										</TableRow>
									) : null}
								</TableBody>
							</Table>
						</Card>
					</div>
				) : null}

				<Dialog
					open={editingRowNumber !== null}
					onOpenChange={(isOpen) => {
						if (!isOpen) {
							closeEditRowDialog();
						}
					}}
				>
					<DialogContent className="sm:max-w-xl">
						<DialogHeader>
							<DialogTitle>Editar linha da importação</DialogTitle>
							<DialogDescription>
								Esta edição ajusta apenas a prévia/importação. O sistema será
								atualizado somente após a confirmação da aplicação.
							</DialogDescription>
						</DialogHeader>

						{editingRowValues ? (
							<div className="grid gap-3 md:grid-cols-2">
								<div className="space-y-1">
									<p className="text-sm font-medium">Data da venda</p>
									<Input
										value={editingRowValues.saleDate}
										onChange={(event) =>
											updateEditingRowValue("saleDate", event.target.value)
										}
										placeholder="YYYY-MM-DD ou DD/MM/YYYY"
									/>
								</div>

								<div className="space-y-1">
									<p className="text-sm font-medium">Grupo</p>
									<Input
										value={editingRowValues.group}
										onChange={(event) =>
											updateEditingRowValue("group", event.target.value)
										}
										placeholder="Informe o grupo"
									/>
								</div>

								<div className="space-y-1">
									<p className="text-sm font-medium">Cota</p>
									<Input
										value={editingRowValues.quota}
										onChange={(event) =>
											updateEditingRowValue("quota", event.target.value)
										}
										placeholder="Informe a cota"
									/>
								</div>

								<div className="space-y-1">
									<p className="text-sm font-medium">Parcela</p>
									<Input
										value={editingRowValues.installment}
										onChange={(event) =>
											updateEditingRowValue("installment", event.target.value)
										}
										placeholder="Ex.: 01/01 ou 1"
									/>
								</div>

								<div className="space-y-1 md:col-span-2">
									<p className="text-sm font-medium">Valor de recebimento</p>
									<Input
										value={editingRowValues.receivedAmount}
										onChange={(event) =>
											updateEditingRowValue(
												"receivedAmount",
												event.target.value,
											)
										}
										placeholder="Ex.: 150,00"
									/>
								</div>
							</div>
						) : null}

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={closeEditRowDialog}
								disabled={previewImport.isPending || applyImport.isPending}
							>
								Cancelar
							</Button>
							<Button
								type="button"
								onClick={() => void handleSaveEditedRow()}
								disabled={previewImport.isPending || applyImport.isPending}
							>
								{previewImport.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Save className="size-4" />
								)}
								Salvar e reprocessar
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				<DialogFooter className="gap-2 sm:justify-between">
					<div className="text-xs text-muted-foreground">
						{step === "PREVIEW"
							? `${selectedReadyRowsCount} linha(s) pronta(s) selecionada(s).`
							: null}
					</div>

					<div className="flex flex-wrap justify-end gap-2">
						{step === "UPLOAD" ? (
							<Button variant="outline" onClick={() => onOpenChange(false)}>
								Fechar
							</Button>
						) : null}

						{step === "MAPPING" ? (
							<>
								<Button variant="outline" onClick={() => setStep("UPLOAD")}>
									Voltar
								</Button>
								<Button
									onClick={() => void handleRunPreview()}
									disabled={
										!canProceedToPreview ||
										Boolean(mappingError) ||
										previewImport.isPending
									}
								>
									{previewImport.isPending ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Upload className="size-4" />
									)}
									Gerar prévia
								</Button>
							</>
						) : null}

						{step === "PREVIEW" ? (
							<>
								<Button variant="outline" onClick={() => setStep("MAPPING")}>
									Voltar
								</Button>
								<Button
									onClick={() => void handleApplySelectedRows()}
									disabled={
										selectedReadyRowsCount === 0 || applyImport.isPending
									}
								>
									{applyImport.isPending ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<CheckCircle2 className="size-4" />
									)}
									Confirmar aplicação
								</Button>
							</>
						) : null}

						{step === "RESULT" ? (
							<>
								<Button
									variant="outline"
									onClick={() => {
										setStep("UPLOAD");
										setParsedFile(null);
										setImportRows([]);
										setPreviewResult(null);
										setApplyResult(null);
										setStatusFilter("ALL");
										setSearchTerm("");
										setEditingRowNumber(null);
										setEditingRowValues(null);
										setSelectedRows(new Set<number>());
										setMapping(EMPTY_MAPPING);
										setSelectedTemplateId("");
										setTemplateName("");
									}}
								>
									Nova importação
								</Button>
								<Button onClick={() => onOpenChange(false)}>Fechar</Button>
							</>
						) : null}
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
