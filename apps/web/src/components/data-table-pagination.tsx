import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

type PaginationToken = number | "start-ellipsis" | "end-ellipsis";

interface DataTablePaginationProps {
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
	pageSizeOptions?: readonly number[];
	onPageChange: (page: number) => void | Promise<void>;
	onPageSizeChange: (pageSize: number) => void | Promise<void>;
	className?: string;
}

function buildPaginationTokens(
	page: number,
	totalPages: number,
	maxVisiblePages = 5,
): PaginationToken[] {
	if (totalPages <= maxVisiblePages) {
		return Array.from({ length: totalPages }, (_, index) => index + 1);
	}

	const startPage = Math.max(
		1,
		Math.min(
			page - Math.floor(maxVisiblePages / 2),
			totalPages - maxVisiblePages + 1,
		),
	);
	const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
	const visiblePages = Array.from(
		{ length: endPage - startPage + 1 },
		(_, index) => startPage + index,
	);
	const tokens: PaginationToken[] = [];

	if (visiblePages[0] !== 1) {
		tokens.push(1);
		if (visiblePages[0] > 2) {
			tokens.push("start-ellipsis");
		}
	}

	tokens.push(...visiblePages);

	if (visiblePages.at(-1) !== totalPages) {
		if ((visiblePages.at(-1) ?? totalPages) < totalPages - 1) {
			tokens.push("end-ellipsis");
		}
		tokens.push(totalPages);
	}

	return tokens;
}

export function DataTablePagination({
	page,
	pageSize,
	totalItems,
	totalPages,
	pageSizeOptions = [10, 20, 50, 100],
	onPageChange,
	onPageSizeChange,
	className,
}: DataTablePaginationProps) {
	if (totalItems === 0) {
		return null;
	}

	const paginationTokens = buildPaginationTokens(page, totalPages);
	const shouldShowPageSizeSelector = pageSizeOptions.length > 1;

	return (
		<div
			className={cn(
				"flex flex-col gap-4 px-1 py-2 md:flex-row md:items-center md:justify-between",
				className,
			)}
		>
			<div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
				<p>
					Página <span className="font-medium text-foreground">{page}</span> de{" "}
					<span className="font-medium text-foreground">{totalPages}</span>
				</p>
				{shouldShowPageSizeSelector ? (
					<div className="flex items-center gap-2">
						<Select
							value={String(pageSize)}
							onValueChange={(value) => void onPageSizeChange(Number(value))}
						>
							<SelectTrigger
								className="h-8 w-[76px] rounded-md border-border/60 bg-transparent px-2.5 text-xs"
								aria-label="Linhas por página"
							>
								<SelectValue placeholder="20" />
							</SelectTrigger>
							<SelectContent>
								{pageSizeOptions.map((option) => (
									<SelectItem key={option} value={String(option)}>
										{option}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				) : null}
			</div>

			<nav
				aria-label="Paginação"
				className="flex flex-wrap items-center justify-start gap-1 md:justify-center"
			>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 min-w-8 rounded-md border-border/60 bg-transparent px-2"
					onClick={() => void onPageChange(page - 1)}
					disabled={page <= 1}
					aria-label="Página anterior"
				>
					<ChevronLeft className="size-3.5" />
				</Button>

				{paginationTokens.map((token) => {
					if (typeof token !== "number") {
						return (
							<span
								key={token}
								className="flex h-8 w-8 items-center justify-center text-muted-foreground"
								aria-hidden="true"
							>
								<MoreHorizontal className="size-3.5" />
							</span>
						);
					}

					const isActive = token === page;
					return (
						<Button
							key={token}
							type="button"
							variant="outline"
							size="sm"
							onClick={() => void onPageChange(token)}
							aria-current={isActive ? "page" : undefined}
							aria-label={`Ir para página ${token}`}
							className={cn(
								"h-8 min-w-8 rounded-md border-border/60 px-2 text-xs",
								isActive
									? "bg-muted text-foreground hover:bg-muted"
									: "bg-transparent text-muted-foreground hover:text-foreground",
							)}
						>
							{token}
						</Button>
					);
				})}

				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 min-w-8 rounded-md border-border/60 bg-transparent px-2"
					onClick={() => void onPageChange(page + 1)}
					disabled={page >= totalPages}
					aria-label="Próxima página"
				>
					<ChevronRight className="size-3.5" />
				</Button>
			</nav>

			<p className="text-sm text-muted-foreground md:text-right">
				<span className="font-medium text-foreground">{totalItems}</span> linhas
				totais
			</p>
		</div>
	);
}

export { buildPaginationTokens };
