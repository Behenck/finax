import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAbility } from "@/permissions/access";
import { Link } from "@tanstack/react-router";
import {
	ArrowLeftRight,
	Building2,
	ClipboardPlus,
	type LucideIcon,
	Package,
	ShoppingCart,
	UserRound,
	Users,
	Wallet,
	Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { QUICK_ACTIONS_COMMAND_OPEN_EVENT } from "./quick-actions-command-events";

type QuickAction = {
	id: string;
	label: string;
	description: string;
	to:
		| "/sales/create"
		| "/sales/quick-create"
		| "/transactions/create"
		| "/commissions"
		| "/registers/products"
		| "/registers/customers"
		| "/registers/partners"
		| "/registers/companies";
	icon: LucideIcon;
	requiredPermission?: string;
};

const QUICK_ACTIONS: QuickAction[] = [
	{
		id: "new-sale",
		label: "Nova venda",
		description: "Lançar venda",
		to: "/sales/create",
		icon: ShoppingCart,
		requiredPermission: "sales.create",
	},
	{
		id: "new-sales-batch",
		label: "Venda em massa",
		description: "Cadastrar vendas em lote",
		to: "/sales/quick-create",
		icon: ClipboardPlus,
		requiredPermission: "sales.create",
	},
	{
		id: "new-transaction",
		label: "Nova transação",
		description: "Lançar receita/despesa",
		to: "/transactions/create",
		icon: ArrowLeftRight,
	},
	{
		id: "commissions",
		label: "Comissões",
		description: "Abrir parcelas",
		to: "/commissions",
		icon: Wallet,
	},
	{
		id: "products",
		label: "Produtos",
		description: "Abrir cadastro de produtos",
		to: "/registers/products",
		icon: Package,
	},
	{
		id: "customers",
		label: "Clientes",
		description: "Abrir cadastro de clientes",
		to: "/registers/customers",
		icon: Users,
	},
	{
		id: "partners",
		label: "Parceiros",
		description: "Abrir cadastro de parceiros",
		to: "/registers/partners",
		icon: UserRound,
	},
	{
		id: "companies",
		label: "Empresas",
		description: "Abrir cadastro de empresas",
		to: "/registers/companies",
		icon: Building2,
	},
];

export function QuickActionsCommand() {
	const ability = useAbility();
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setIsOpen((current) => !current);
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	useEffect(() => {
		function onOpen() {
			setIsOpen(true);
		}

		window.addEventListener(QUICK_ACTIONS_COMMAND_OPEN_EVENT, onOpen);
		return () => {
			window.removeEventListener(QUICK_ACTIONS_COMMAND_OPEN_EVENT, onOpen);
		};
	}, []);

	const visibleActions = useMemo(
		() =>
			QUICK_ACTIONS.filter((action) =>
				action.requiredPermission
					? ability.can("access", action.requiredPermission)
					: true,
			),
		[ability],
	);

	const filteredActions = useMemo(() => {
		const term = query.trim().toLowerCase();
		if (!term) {
			return visibleActions;
		}

		return visibleActions.filter((action) =>
			`${action.label} ${action.description}`.toLowerCase().includes(term),
		);
	}, [query, visibleActions]);

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				setIsOpen(open);
				if (!open) {
					setQuery("");
				}
			}}
		>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle>Ações rápidas</DialogTitle>
				</DialogHeader>

				<div className="space-y-3">
					<Input
						autoFocus
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Buscar ação..."
					/>
					<div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
						<Zap className="size-3.5" />
						Dica: use Ctrl + K para abrir rapidamente
					</div>
					<div className="max-h-[340px] space-y-1 overflow-y-auto">
						{filteredActions.length === 0 ? (
							<p className="rounded-md px-3 py-2 text-sm text-muted-foreground">
								Nenhuma ação encontrada.
							</p>
						) : (
							filteredActions.map((action) => {
								const Icon = action.icon;

								return (
									<Link
										key={action.id}
										to={action.to}
										onClick={() => {
											setIsOpen(false);
											setQuery("");
										}}
										className={cn(
											"flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
											"hover:bg-accent hover:text-accent-foreground",
										)}
									>
										<Icon className="size-4 text-muted-foreground" />
										<div className="flex flex-col">
											<span className="text-sm font-medium">{action.label}</span>
											<span className="text-xs text-muted-foreground">
												{action.description}
											</span>
										</div>
									</Link>
								);
							})
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
