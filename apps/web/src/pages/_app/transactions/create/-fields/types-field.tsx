import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function TypesField() {
	return (
		<Card className="p-5 rounded-sm gap-3">
			<Label className="font-semibold">Tipo de Transação</Label>
			<div className="flex gap-3">
				<Button
					variant="outline"
					className="flex flex-col items-center justify-center gap-1 p-10 flex-1"
				>
					<span className="text-gray-600">Despesa</span>
					<span className="text-xs text-gray-500 font-light">
						Saida de dinheiro
					</span>
				</Button>
				<Button
					variant="outline"
					className="flex flex-col items-center justify-center p-10 flex-1"
				>
					<span className="text-gray-600">Receita</span>
					<span className="text-xs text-gray-500 font-light">
						Entrada de dinheiro
					</span>
				</Button>
			</div>
			<div className="flex gap-3">
				<Button
					variant="outline"
					className="flex flex-col items-center justify-center gap-1 p-4 flex-1"
				>
					<span className="text-gray-600 text-xs font-normal">Fixa</span>
				</Button>
				<Button
					variant="outline"
					className="flex flex-col items-center justify-center p-4 flex-1"
				>
					<span className="text-gray-600 text-xs font-normal">Variável</span>
				</Button>
			</div>
		</Card>
	);
}
