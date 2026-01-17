import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	transactionSchema,
	type TransactionFormData,
} from "@/schemas/transaction-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { TypesField } from "./-fields/types-field";
import { BasicInformationField } from "./-fields/basic-information-field";
import { ClassificationField } from "./-fields/classification-field";
import { AmountItemsField } from "./-fields/amount-items-field";

export const Route = createFileRoute("/_app/transactions/create/")({
	component: CreateTransaction,
});

function CreateTransaction() {
	const { handleSubmit, control } = useForm<TransactionFormData>({
		resolver: zodResolver(transactionSchema as any),
		defaultValues: {
			items: [],
		},
	});

	return (
		<main className="space-y-6">
			<header className="flex gap-6 items-center">
				<Button variant="ghost" size="icon-sm" asChild>
					<Link to="/transactions">
						<ArrowLeft className="size-4" />
					</Link>
				</Button>
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold">Nova Transação</h1>
					<span className="text-gray-500 text-sm">
						Adicione uma nova receita ou despesa
					</span>
				</div>
			</header>

			<div className="space-y-6">
				<TypesField />
				<BasicInformationField control={control} />
				<ClassificationField control={control} />
				<AmountItemsField control={control} />
				<Card className="p-5 rounded-sm gap-3">
					<Label className="font-semibold">Recorrência / Parcelas</Label>
					<FieldGroup>
						<Field>
							<FieldLabel>Tipo</FieldLabel>
							<Input placeholder="Select Unica Vez" />
						</Field>
					</FieldGroup>
				</Card>
				<Card className="p-5 rounded-sm gap-3">
					<div className="flex items-center justify-between">
						<Label className="font-semibold">Reembolso</Label>
						<span className="text-xs">Esta despesa tem reembolso</span>
					</div>
				</Card>
				<Card className="p-5 rounded-sm gap-3">
					<FieldGroup>
						<Field>
							<FieldLabel>Observações</FieldLabel>
							<Input placeholder="Adicione observações sobre esta transação" />
						</Field>
					</FieldGroup>
				</Card>
				<div className="flex gap-3 items-center justify-end">
					<Button variant="outline" asChild>
						<Link to="/transactions">Cancelar</Link>
					</Button>
					<Button type="submit">Salvar Transação</Button>
				</div>
			</div>
		</main>
	);
}
