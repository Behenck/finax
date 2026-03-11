import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
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
	return (
		<div className="flex items-center justify-end gap-3">
			<Button type="button" variant="outline" asChild>
				<Link to="/sales">Cancelar</Link>
			</Button>
			<Button
				type="submit"
				disabled={isPending || isLoadingOptions || isDynamicFieldsLoading}
			>
				{isPending
					? "Salvando..."
					: mode === "CREATE"
						? "Salvar venda"
						: "Atualizar venda"}
			</Button>
		</div>
	);
}
