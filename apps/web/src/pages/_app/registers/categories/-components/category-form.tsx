import { Button } from "@/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	categorySchema,
	type CategoryFormData,
} from "@/schemas/category-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { getLucideIcon } from "@/components/lucide-icon";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Palette } from "lucide-react";
import type z from "zod";
import { cn } from "@/lib/utils";
import type { Category, CategoryChild } from "@/schemas/types/category";
import { formatTitleCase } from "@/utils/format-title-case";
import { formatCategoryCode } from "@/utils/format-category-code";
import { getOrganizationsSlugCategoriesQueryKey, usePostOrganizationsSlugCategories, usePutOrganizationsSlugCategoriesId, type CategoriesTypeEnumKey } from "@/http/generated";
import { useApp } from "@/context/app-context";
import { useQueryClient } from "@tanstack/react-query";

export type CreateCategoryType = z.infer<typeof categorySchema>;

interface CreateCategoryFormProps {
	onSuccess?: () => void;
	mode?: "create" | "edit";
	initialData?: Category | CategoryChild;
	type?: CategoriesTypeEnumKey;
	parentId?: string;
	parentColor?: string;
}

const AVAILABLE_ICONS = [
	"MoreHorizontal",
	"Utensils",
	"ShoppingBag",
	"ShoppingCart",
	"Coffee",
	"Home",
	"Car",
	"Plane",
	"Train",
	"CreditCard",
	"Wallet",
	"PiggyBank",
	"Landmark",
	"TrendingUp",
	"TrendingDown",
	"DollarSign",
	"GraduationCap",
	"Book",
	"Gamepad2",
	"Music",
	"Film",
	"Tv",
	"Smartphone",
	"Laptop",
	"HeartPulse",
	"Stethoscope",
	"Dumbbell",
	"Bike",
	"Running",
	"Shirt",
	"Baby",
	"Gamepad",
	"Briefcase",
	"Building",
	"Wrench",
	"Hammer",
	"Paintbrush",
	"Palette",
	"Camera",
	"Headphones",
	"Gift",
	"Cake",
	"Beer",
	"Wine",
	"Pizza",
	"IceCream",
	"Users",
	"User",
	"Heart",
	"Smile",
	"AlertTriangle",
	"Shield",
	"Lock",
	"Key",
	"Bell",
	"Mail",
	"Phone",
	"MessageSquare",
	"Repeat",
	"RefreshCw",
	"ArrowLeftRight",
	"ArrowUpDown",
	"Settings",
];

const PRESET_COLORS = [
	"#0EA5E9", // Sky
	"#F97316", // Orange
	"#EC4899", // Pink
	"#8B5CF6", // Purple
	"#22C55E", // Green
	"#F59E0B", // Amber
	"#EF4444", // Red
	"#10B981", // Emerald
];

export function CategoryForm({
	onSuccess,
	mode,
	initialData,
	type,
	parentId,
	parentColor,
}: CreateCategoryFormProps) {
	const { organization } = useApp()
	const queryClient = useQueryClient()

	const { mutateAsync: createCategory } = usePostOrganizationsSlugCategories();
	const { mutateAsync: updateCategory } = usePutOrganizationsSlugCategoriesId();

	const { handleSubmit, control } = useForm<CreateCategoryType>({
		resolver: zodResolver(categorySchema as any),
		defaultValues: {
			name: initialData?.name ?? "",
			code: initialData?.code ?? "",
			icon: initialData?.icon ?? "",
			color: initialData?.color ?? parentColor ?? "#000000",
			type: initialData?.type ?? type ?? "OUTCOME",
		},
	});

	const selectedColor = useWatch({
		control,
		name: "color",
	});

	async function onSubmit(data: CategoryFormData) {
		if (mode === "edit" && initialData) {
			await updateCategory({
				slug: organization!.slug,
				id: initialData.id,
				data,
			}, {
				onSuccess: async () => {
					await queryClient.invalidateQueries({
						queryKey: getOrganizationsSlugCategoriesQueryKey({
							slug: organization!.slug,
						}),
					})
				},
			});
		} else {
			const { parentId: oldParentId, ...rest } = data;

			const payload = {
				...rest,
				parentId,
			}

			await createCategory({
				slug: organization!.slug,
				data: payload
			}, {
				onSuccess: async () => {
					await queryClient.invalidateQueries({
						queryKey: getOrganizationsSlugCategoriesQueryKey({
							slug: organization!.slug,
						}),
					})
				},
			});
		}

		onSuccess?.();
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
			<FieldGroup>
				<Controller
					name="name"
					control={control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid} className="gap-1">
							<FieldLabel htmlFor="name">Nome</FieldLabel>
							<div>
								<Input
									{...field}
									id="name"
									type="text"
									autoCapitalize="none"
									autoCorrect="off"
									aria-invalid={fieldState.invalid}
									aria-describedby={
										fieldState.invalid ? "name-error" : undefined
									}
									placeholder="Ex: Alimentação, Transporte..."
									onChange={(event) => {
										const formattedValue = formatTitleCase(event.target.value);
										field.onChange(formattedValue);
									}}
								/>
							</div>
							{fieldState.invalid && (
								<FieldError id="name-error" errors={[fieldState.error]} />
							)}
						</Field>
					)}
				/>
			</FieldGroup>
			<FieldGroup>
				<Controller
					name="code"
					control={control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid} className="gap-1">
							<FieldLabel htmlFor="code">Código</FieldLabel>
							<div>
								<Input
									{...field}
									id="code"
									type="text"
									autoCapitalize="none"
									autoCorrect="off"
									aria-invalid={fieldState.invalid}
									aria-describedby={
										fieldState.invalid ? "code-error" : undefined
									}
									placeholder="Ex: 1.1.01.001"
									onChange={(event) => {
										const formattedValue = formatCategoryCode(
											event.target.value,
										);
										field.onChange(formattedValue);
									}}
								/>
							</div>
							{fieldState.invalid && (
								<FieldError id="code-error" errors={[fieldState.error]} />
							)}
						</Field>
					)}
				/>
			</FieldGroup>
			{!parentId && (
				<FieldGroup>
					<Controller
						name="type"
						control={control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid} className="gap-1">
								<FieldLabel>Tipo</FieldLabel>
								<Select
									value={field.value ?? ""}
									onValueChange={field.onChange}
								>
									<SelectTrigger>
										<SelectValue placeholder="Selecione" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="INCOME">Receita</SelectItem>
										<SelectItem value="OUTCOME">Despesa</SelectItem>
									</SelectContent>
								</Select>
								{fieldState.invalid && (
									<FieldError id="type-error" errors={[fieldState.error]} />
								)}
							</Field>
						)}
					/>
				</FieldGroup>
			)}
			<FieldGroup>
				<Controller
					name="icon"
					control={control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid} className="gap-1">
							<FieldLabel>Ícone</FieldLabel>
							<ScrollArea className="h-[160px] w-full">
								<div className="grid grid-cols-6 gap-2 p-3">
									{AVAILABLE_ICONS.map((iconName) => {
										const Icon = getLucideIcon(iconName);
										const isSelected = field.value === iconName;
										return (
											<Button
												variant="ghost"
												size="icon"
												key={iconName}
												type="button"
												onClick={() => field.onChange(iconName)}
												className={cn(
													"flex items-center justify-center p-2 rounded-md border-none bg-gray-50 transition-colors",
													isSelected
														? "bg-gray-200 text-primary-foreground"
														: "hover:bg-gray-100 hover:text-gray-100 border-border",
												)}
											>
												<Icon
													className="size-5"
													style={
														selectedColor ? { color: selectedColor } : undefined
													}
												/>
											</Button>
										);
									})}
								</div>
							</ScrollArea>
							{fieldState.invalid && (
								<FieldError id="icon-error" errors={[fieldState.error]} />
							)}
						</Field>
					)}
				/>
			</FieldGroup>
			{!parentId && (
				<FieldGroup>
					<Controller
						name="color"
						control={control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid} className="gap-1">
								<FieldLabel>Cor</FieldLabel>
								<div className="flex items-center gap-3">
									<div className="flex gap-2 flex-1">
										{PRESET_COLORS.map((color) => {
											const isSelected = field.value === color;
											return (
												<button
													key={color}
													type="button"
													onClick={() => field.onChange(color)}
													className={cn(
														"w-9 h-9 rounded-full border-2 transition-all",
														isSelected
															? "border-gray-900 scale-110 shadow-md"
															: "border-gray-200 hover:border-gray-300 hover:scale-105",
													)}
													style={{ backgroundColor: color }}
													aria-label={`Cor ${color}`}
												/>
											);
										})}
									</div>
									<div className="relative flex items-center">
										<label
											htmlFor="custom-color-picker"
											className="relative flex items-center justify-center w-10 h-10 rounded-full border-2 border-gray-300 cursor-pointer transition-all hover:scale-105 hover:border-gray-400"
											style={{ backgroundColor: field.value || "#F3F4F6" }}
											title="Escolher cor personalizada"
										>
											<Palette
												className={cn(
													"size-5",
													field.value
														? "text-white drop-shadow-md"
														: "text-gray-600",
												)}
											/>
											<input
												id="custom-color-picker"
												type="color"
												value={field.value || "#000000"}
												onChange={(e) => field.onChange(e.target.value)}
												className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
												aria-label="Escolher cor personalizada"
											/>
										</label>
									</div>
								</div>
								{fieldState.invalid && (
									<FieldError id="color-error" errors={[fieldState.error]} />
								)}
							</Field>
						)}
					/>
				</FieldGroup>
			)}
			<div className="flex justify-end gap-2">
				<Button type="submit">Salvar</Button>
			</div>
		</form>
	);
}
