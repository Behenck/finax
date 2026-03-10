import { Bold, Italic, List, ListOrdered, Underline } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sanitizeRichTextHtml } from "./sale-dynamic-fields";

interface RichTextEditorProps {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	placeholder?: string;
}

function applyEditorCommand(command: string) {
	document.execCommand(command, false);
}

export function RichTextEditor({
	value,
	onChange,
	disabled = false,
	placeholder = "Digite o conteúdo...",
}: RichTextEditorProps) {
	const editorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!editorRef.current) {
			return;
		}

		const sanitizedValue = sanitizeRichTextHtml(value);
		if (editorRef.current.innerHTML !== sanitizedValue) {
			editorRef.current.innerHTML = sanitizedValue;
		}
	}, [value]);

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 p-1">
				<Button
					type="button"
					size="icon"
					variant="ghost"
					onClick={() => applyEditorCommand("bold")}
					disabled={disabled}
					aria-label="Negrito"
				>
					<Bold className="size-4" />
				</Button>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					onClick={() => applyEditorCommand("italic")}
					disabled={disabled}
					aria-label="Itálico"
				>
					<Italic className="size-4" />
				</Button>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					onClick={() => applyEditorCommand("underline")}
					disabled={disabled}
					aria-label="Sublinhado"
				>
					<Underline className="size-4" />
				</Button>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					onClick={() => applyEditorCommand("insertUnorderedList")}
					disabled={disabled}
					aria-label="Lista com marcadores"
				>
					<List className="size-4" />
				</Button>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					onClick={() => applyEditorCommand("insertOrderedList")}
					disabled={disabled}
					aria-label="Lista numerada"
				>
					<ListOrdered className="size-4" />
				</Button>
			</div>

			<div
				ref={editorRef}
				contentEditable={!disabled}
				suppressContentEditableWarning
				className={cn(
					"min-h-[140px] rounded-md border p-3 text-sm outline-none",
					disabled ? "cursor-not-allowed bg-muted/30 text-muted-foreground" : "",
				)}
				onInput={(event) => {
					const html = (event.currentTarget as HTMLDivElement).innerHTML;
					onChange(sanitizeRichTextHtml(html));
				}}
				data-placeholder={placeholder}
			/>
		</div>
	);
}
