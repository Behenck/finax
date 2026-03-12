import { type UseFormReturn } from "react-hook-form";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { QuickProductData, QuickProductInput } from "../quick-product-schema";

interface QuickProductDialogProps {
	open: boolean;
	onOpenChange(open: boolean): void;
	form: UseFormReturn<QuickProductInput, unknown, QuickProductData>;
	isPending: boolean;
	onSubmit(data: QuickProductData): void | Promise<void>;
}

export function QuickProductDialog({
	open,
	onOpenChange,
	form,
	isPending,
	onSubmit,
}: QuickProductDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Cadastrar produto rápido</DialogTitle>
					<DialogDescription>
						Cria um produto básico para continuar a venda sem sair do fluxo.
					</DialogDescription>
				</DialogHeader>

				<FieldGroup>
					<Field className="gap-1">
						<FieldLabel>Nome do produto *</FieldLabel>
						<Input
							{...form.register("name")}
							placeholder="Ex.: Plano Premium"
						/>
						<FieldError error={form.formState.errors.name} />
					</Field>
				</FieldGroup>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						Cancelar
					</Button>
					<Button
						type="button"
						onClick={form.handleSubmit(onSubmit)}
						disabled={isPending}
					>
						{isPending ? "Cadastrando..." : "Cadastrar produto"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
