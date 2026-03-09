import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTransactions } from "@/hooks/transactions/use-transactions";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { EllipsisVertical, Plus, Search } from "lucide-react";
import { useState } from "react";
import { BadgeStatus } from "./-components/badge-status";
import { TransactionAmount } from "./-components/transaction-amount";
import { Summary } from "./-components/summary";
import { TransactionType } from "./-components/transaction-type";

export const Route = createFileRoute("/_app/transactions/")({
	component: RouteComponent,
});

function RouteComponent() {
	const [search, setSearch] = useState("");
	const { data: transactions } = useTransactions()

	return (
		<main className="w-full space-y-6">
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold">Gerenciar Transações</h1>
					<span className="text-muted-foreground text-sm">Gerencie todas as transações financeiras da sua empresa</span>
				</div>

				<Button asChild className="rounded-sm" size="lg">
					<Link to="/transactions/create">
						<Plus />
						Nova Transação
					</Link>
				</Button>
			</header>

			<Summary />

			<div className="relative">
				<Search className="absolute left-5 top-1/2 -translate-1/2 size-4 text-gray-500" />
				<Input
					placeholder="Buscar nome ou código..."
					className="max-w-[40%] h-10 pl-10"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>

			<Table>
				<TableCaption>Lista de transações.</TableCaption>
				<TableHeader>
					<TableRow>
						<TableHead>📅 Vencimento</TableHead>
						<TableHead className="w-[400px]">📝 Descrição</TableHead>
						<TableHead className="w-[100px]">🔄 Transação</TableHead>
						<TableHead>🏢 Empresa</TableHead>
						<TableHead>📌 Tipo</TableHead>
						<TableHead>🏷️ Categoria</TableHead>
						<TableHead>💰 Valor</TableHead>
						<TableHead>✅ Status</TableHead>
						<TableHead></TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{transactions?.map((transaction) => {
						const dueDate = format(transaction.dueDate, 'dd/MM/yyyy')
						const expectedPaymentDate = format(transaction.expectedPaymentDate, 'dd/MM/yyyy')
						return (
							<TableRow>
								<TableCell>
									<div className="flex flex-col gap-0 justify-center">
										<span className="text-sm font-medium">{dueDate}</span>
										<span className="text-xs text-gray-500">Prev: {expectedPaymentDate}</span>
									</div>
								</TableCell>
								<TableCell>
									<div className="flex flex-col gap-0 justify-center">
										<span className="text-sm font-medium">{transaction.description}</span>
										<span className="text-xs text-gray-500">{transaction.costCenter.name}</span>
									</div>
								</TableCell>
								<TableCell>{transaction.code}</TableCell>
								<TableCell>{transaction.company.name}</TableCell>
								<TableCell>
									<TransactionType type={transaction.type} refundedBy={transaction.refundedByEmployee} />
								</TableCell>
								<TableCell>
									<div className="flex flex-col gap-0 justify-center">
										{!!transaction.category.children ? (
											<>
												<span className="">{transaction.category.name}</span>
												<span className="text-xs text-gray-500">{transaction.category.children.name}</span>
											</>
										) : (
											<span className="">{transaction.category.name}</span>
										)}
									</div>
								</TableCell>
								<TableCell >
									<TransactionAmount type={transaction.type}>{transaction.totalAmount}</TransactionAmount>
								</TableCell>
								<TableCell>
									<BadgeStatus status={transaction.status} dueDate={transaction.dueDate} />
								</TableCell>
								<TableCell>
									<Button variant="ghost" asChild>
										<Link
											to="/transactions/update/$transactionId"
											params={{ transactionId: transaction.id }}
										>
											<EllipsisVertical className="size-4" />
										</Link>
									</Button>
								</TableCell>
							</TableRow>
						)
					})}
				</TableBody>
			</Table>
		</main >
	);
}
