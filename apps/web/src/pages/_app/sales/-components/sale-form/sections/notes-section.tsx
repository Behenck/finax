import type { UseFormRegister } from "react-hook-form";
import { FieldError } from "@/components/field-error";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { SaleFormInput } from "@/schemas/sale-schema";

interface NotesSectionProps {
	register: UseFormRegister<SaleFormInput>;
	notesError?: unknown;
}

export function NotesSection({ register, notesError }: NotesSectionProps) {
	return (
		<Card className="rounded-sm gap-4 p-5">
			<h2 className="font-semibold text-md">Observações</h2>
			<FieldGroup>
				<Field className="gap-1">
					<FieldLabel>Observação</FieldLabel>
					<Textarea
						rows={4}
						placeholder="Informações adicionais sobre a venda..."
						{...register("notes")}
					/>
					<FieldError error={notesError} />
				</Field>
			</FieldGroup>
		</Card>
	);
}
