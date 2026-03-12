import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MobileBottomActionBar } from "@/components/mobile-bottom-action-bar";
import type { SaleFormProps } from "../types";

interface SubmitActionsProps {
	mode: NonNullable<SaleFormProps["mode"]>;
	isPending: boolean;
	isLoadingOptions: boolean;
	isDynamicFieldsLoading: boolean;
}

export function SubmitActions({
	mode,
	isPending,
	isLoadingOptions,
	isDynamicFieldsLoading,
}: SubmitActionsProps) {
	const isDisabled = isPending || isLoadingOptions || isDynamicFieldsLoading;
	const submitLabel = isPending
		? "Salvando..."
		: mode === "CREATE"
			? "Salvar venda"
			: "Atualizar venda";

	return (
		<>
			<div className="hidden items-center justify-end gap-3 md:flex">
				<Button type="button" variant="outline" asChild>
					<Link to="/sales">Cancelar</Link>
				</Button>
				<Button type="submit" disabled={isDisabled}>
					{submitLabel}
				</Button>
			</div>

			<MobileBottomActionBar>
				<div className="grid grid-cols-2 gap-2">
					<Button type="button" variant="outline" asChild>
						<Link to="/sales">Cancelar</Link>
					</Button>
					<Button type="submit" disabled={isDisabled}>
						{submitLabel}
					</Button>
				</div>
			</MobileBottomActionBar>
			<div className="h-20 md:hidden" />
		</>
	);
}
