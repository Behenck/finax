import { Controller, type Control } from "react-hook-form";
import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import type { SaleFormData, SaleFormInput } from "@/schemas/sale-schema";
import type {
	SaleHierarchicalProductOption,
	SaleRootProductOption,
} from "@/hooks/sales/use-sale-form-options";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ProductSectionProps {
	control: Control<SaleFormInput, unknown, SaleFormData>;
	rootProducts: SaleRootProductOption[];
	hierarchicalProducts: SaleHierarchicalProductOption[];
	isLoadingOptions: boolean;
}

const PARENT_ONLY_VALUE = "__PARENT_ONLY__";

function normalizeSearchValue(value: string) {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.trim();
}

export function ProductSection({
	control,
	rootProducts,
	hierarchicalProducts,
	isLoadingOptions,
}: ProductSectionProps) {
	const [isParentOpen, setIsParentOpen] = useState(false);
	const [isChildOpen, setIsChildOpen] = useState(false);
	const [parentQuery, setParentQuery] = useState("");
	const [childQuery, setChildQuery] = useState("");

	const productsById = useMemo(
		() => new Map(hierarchicalProducts.map((product) => [product.id, product])),
		[hierarchicalProducts],
	);
	const descendantsCountByRootId = useMemo(() => {
		const counts = new Map<string, number>();

		for (const product of hierarchicalProducts) {
			if (product.depth === 0) {
				continue;
			}

			counts.set(product.rootId, (counts.get(product.rootId) ?? 0) + 1);
		}

		return counts;
	}, [hierarchicalProducts]);

	return (
		<Card className="rounded-sm gap-4 p-5">
			<div className="space-y-1">
				<h2 className="font-semibold text-md">Produto</h2>
				<p className="text-muted-foreground text-sm">
					Selecione o produto pai e, opcionalmente, um produto filho para
					detalhar a venda.
				</p>
			</div>

			<FieldGroup>
				<Controller
					control={control}
					name="productId"
					render={({ field, fieldState }) => {
						const selectedProduct = productsById.get(field.value);
						const selectedRootId = selectedProduct?.rootId ?? "";
						const selectedRoot = rootProducts.find(
							(rootProduct) => rootProduct.id === selectedRootId,
						);
						const childProducts = hierarchicalProducts.filter(
							(product) => product.rootId === selectedRootId && product.depth > 0,
						);
						const selectedChildValue =
							selectedProduct && selectedProduct.depth > 0
								? selectedProduct.id
								: PARENT_ONLY_VALUE;

						const normalizedParentQuery = normalizeSearchValue(parentQuery);
						const normalizedChildQuery = normalizeSearchValue(childQuery);

						const filteredRootProducts = rootProducts.filter((rootProduct) => {
							if (!normalizedParentQuery) {
								return true;
							}

							return normalizeSearchValue(
								`${rootProduct.name} ${rootProduct.label}`,
							).includes(normalizedParentQuery);
						});
						const filteredChildProducts = childProducts.filter((childProduct) => {
							if (!normalizedChildQuery) {
								return true;
							}

							return normalizeSearchValue(
								`${childProduct.name} ${childProduct.relativeLabel} ${childProduct.fullLabel}`,
							).includes(normalizedChildQuery);
						});
						const hasChildren = childProducts.length > 0;

						return (
							<div className="space-y-3">
								<Field className="gap-1">
									<FieldLabel>Produto pai *</FieldLabel>
									<Popover open={isParentOpen} onOpenChange={setIsParentOpen}>
										<PopoverTrigger asChild>
											<Button
												type="button"
												variant="outline"
												role="combobox"
												disabled={isLoadingOptions}
												className="w-full justify-between"
											>
												<span className="truncate">
													{selectedRoot?.label ?? "Selecione o produto pai"}
												</span>
												<ChevronDown className="size-4 text-muted-foreground" />
											</Button>
										</PopoverTrigger>
										<PopoverContent
											align="start"
											className="w-[var(--radix-popover-trigger-width)] p-2"
										>
											<div className="space-y-2">
												<Input
													value={parentQuery}
													onChange={(event) => setParentQuery(event.target.value)}
													placeholder="Buscar produto pai..."
												/>
												<div className="max-h-64 overflow-y-auto rounded-md border">
													{filteredRootProducts.length === 0 ? (
														<p className="p-2 text-sm text-muted-foreground">
															Nenhum produto pai encontrado.
														</p>
													) : (
														filteredRootProducts.map((rootProduct) => {
															const childrenCount =
																descendantsCountByRootId.get(rootProduct.id) ?? 0;
															const isSelected = selectedRootId === rootProduct.id;

															return (
																<button
																	key={rootProduct.id}
																	type="button"
																	className={cn(
																		"flex w-full items-start justify-between gap-2 px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
																		isSelected && "bg-accent",
																	)}
																	onClick={() => {
																		field.onChange(rootProduct.id);
																		setChildQuery("");
																		setIsChildOpen(false);
																		setIsParentOpen(false);
																	}}
																>
																	<div className="space-y-0.5">
																		<p className="font-medium">{rootProduct.label}</p>
																		<p className="text-xs text-muted-foreground">
																			{childrenCount > 0
																				? `${childrenCount} filho(s)`
																				: "Sem filhos"}
																		</p>
																	</div>
																	{isSelected ? <Check className="mt-0.5 size-4" /> : null}
																</button>
															);
														})
													)}
												</div>
											</div>
										</PopoverContent>
									</Popover>
								</Field>

								<Field className="gap-1">
									<FieldLabel>Produto filho (opcional)</FieldLabel>
									<Popover open={isChildOpen} onOpenChange={setIsChildOpen}>
										<PopoverTrigger asChild>
											<Button
												type="button"
												variant="outline"
												role="combobox"
												disabled={isLoadingOptions || !selectedRoot || !hasChildren}
												className="w-full justify-between"
											>
												<span className="truncate">
													{!selectedRoot
														? "Selecione o produto pai primeiro"
														: !hasChildren
															? "Este produto pai não possui filhos"
															: selectedChildValue === PARENT_ONLY_VALUE
																? "Usar somente produto pai"
																: (productsById.get(selectedChildValue)?.relativeLabel ??
																	"Selecione o produto filho")}
												</span>
												<ChevronDown className="size-4 text-muted-foreground" />
											</Button>
										</PopoverTrigger>
										<PopoverContent
											align="start"
											className="w-[var(--radix-popover-trigger-width)] p-2"
										>
											<div className="space-y-2">
												<Input
													value={childQuery}
													onChange={(event) => setChildQuery(event.target.value)}
													placeholder="Buscar produto filho..."
													disabled={!hasChildren}
												/>
												<div className="max-h-64 overflow-y-auto rounded-md border">
													<button
														type="button"
														className={cn(
															"flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
															selectedChildValue === PARENT_ONLY_VALUE && "bg-accent",
														)}
														onClick={() => {
															if (!selectedRoot) {
																return;
															}

															field.onChange(selectedRoot.id);
															setIsChildOpen(false);
														}}
													>
														<span>Usar somente produto pai</span>
														{selectedChildValue === PARENT_ONLY_VALUE ? (
															<Check className="size-4" />
														) : null}
													</button>

													{filteredChildProducts.length === 0 ? (
														<p className="p-2 text-sm text-muted-foreground">
															{hasChildren
																? "Nenhum filho encontrado."
																: "Sem filhos para este pai."}
														</p>
													) : (
														filteredChildProducts.map((childProduct) => {
															const isSelected = selectedChildValue === childProduct.id;

															return (
																<button
																	key={childProduct.id}
																	type="button"
																	className={cn(
																		"flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
																		isSelected && "bg-accent",
																	)}
																	onClick={() => {
																		field.onChange(childProduct.id);
																		setIsChildOpen(false);
																	}}
																>
																	<span className="truncate">
																		{childProduct.relativeLabel}
																	</span>
																	{isSelected ? <Check className="size-4" /> : null}
																</button>
															);
														})
													)}
												</div>
											</div>
										</PopoverContent>
									</Popover>
									<p className="text-xs text-muted-foreground">
										Se nenhum filho for escolhido, a venda será vinculada ao
										produto pai.
									</p>
								</Field>

								<FieldError error={fieldState.error} />
							</div>
						);
					}}
				/>
			</FieldGroup>
		</Card>
	);
}
