import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import type { TransactionFormData } from "@/schemas/transaction-schema"
import { Controller, type Control } from "react-hook-form"
import { cn } from "@/lib/utils"

interface TypesFieldProps {
	control: Control<TransactionFormData>
}

export function TypesField({ control }: TypesFieldProps) {
	return (
		<Card className="p-5 rounded-sm gap-3">
			<Label className="font-semibold">Tipo de Transação</Label>

			{/* TYPE */}
			<div className="flex gap-3">
				<Controller
					name="type"
					control={control}
					render={({ field }) => (
						<>
							{/* DESPESA */}
							<Button
								type="button"
								variant="outline"
								onClick={() => field.onChange("OUTCOME")}
								className={cn(
									"flex flex-col items-center justify-center gap-1 p-10 flex-1 transition text-gray-600 hover:text-gray-600",
									field.value === "OUTCOME" &&
									"bg-red-50 text-red-700 border-red-500 hover:bg-red-50 hover:text-red-700"
								)}
							>
								<span>Despesa</span>
								<span className="text-xs font-light">
									Saída de dinheiro
								</span>
							</Button>

							{/* RECEITA */}
							<Button
								type="button"
								variant="outline"
								onClick={() => field.onChange("INCOME")}
								className={cn(
									"flex flex-col items-center justify-center gap-1 p-10 flex-1 transition text-gray-600 hover:text-gray-600",
									field.value === "INCOME" &&
									"bg-green-50 text-green-700 border-green-500 hover:bg-green-50 hover:text-green-700"
								)}
							>
								<span>Receita</span>
								<span className="text-xs font-light">
									Entrada de dinheiro
								</span>
							</Button>
						</>
					)}
				/>
			</div>

			{/* NATURE */}
			<div className="flex gap-3">
				<Controller
					name="nature"
					control={control}
					render={({ field }) => (
						<>
							{/* FIXA */}
							<Button
								type="button"
								variant="outline"
								onClick={() => field.onChange("FIXED")}
								className={cn(
									"flex flex-col items-center justify-center gap-1 p-4 flex-1 transition text-gray-600 hover:text-gray-600",
									field.value === "FIXED" &&
									"bg-green-50 text-green-700 border-green-500 hover:bg-green-50 hover:text-green-700"
								)}
							>
								<span className="text-xs font-normal">Fixa</span>
							</Button>

							{/* VARIÁVEL */}
							<Button
								type="button"
								variant="outline"
								onClick={() => field.onChange("VARIABLE")}
								className={cn(
									"flex flex-col items-center justify-center gap-1 p-4 flex-1 transition text-gray-600 hover:text-gray-600",
									field.value === "VARIABLE" &&
									"bg-green-50 text-green-700 border-green-500 hover:bg-green-50 hover:text-green-700"
								)}
							>
								<span className="text-xs font-normal">Variável</span>
							</Button>
						</>
					)}
				/>
			</div>
		</Card>
	)
}
