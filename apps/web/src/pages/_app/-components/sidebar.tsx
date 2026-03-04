import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
	Building2,
	ChevronRight,
	Contact,
	CreditCard,
	Database,
	Home,
	IdCardLanyard,
	LineChart,
	LogOut,
	Network,
	PersonStanding,
	Package,
	Settings,
	Tags,
	type LucideIcon,
} from "lucide-react";
import LogoBranco from "@/assets/logo-finax-branco.png";
import { Separator } from "@/components/ui/separator";
import { Link } from "@tanstack/react-router";
import { auth } from "@/hooks/auth";
import { useApp } from "@/context/app-context";

interface ItemsProps {
	title: string;
	url: string;
	icon: LucideIcon;
	action?: () => void;
	children?: {
		title: string;
		url: string;
		icon: LucideIcon;
		action?: () => void;
	}[];
}

export function AppSidebar() {
	const { organization, auth: currentUser } = useApp();
	const signOut = auth.useSignOut();

	const items: ItemsProps[] = [
		{
			title: "Dashboard",
			url: "/",
			icon: Home,
		},
		{
			title: "Cadastros",
			icon: Database,
			url: "/",
			children: [
				{
					icon: Building2,
					title: "Empresas",
					url: "/registers/companies",
				},
				{
					icon: Contact,
					title: "Clientes",
					url: "/registers/customers",
				},
				{
					icon: PersonStanding,
					title: "Vendedores",
					url: "/registers/sellers",
				},
				{
					icon: PersonStanding,
					title: "Parceiros",
					url: "/registers/partners",
				},
				{
					icon: Tags,
					title: "Categorias",
					url: "/registers/categories",
				},
				{
					icon: Package,
					title: "Produtos",
					url: "/registers/products",
				},
				{
					icon: Network,
					title: "Centro de Custos",
					url: "/registers/cost-centers",
				},
				{
					icon: IdCardLanyard,
					title: "Funcionários",
					url: "/registers/employees",
				},
			],
		},
		{
			title: "Transações",
			url: "/transactions",
			icon: CreditCard,
		},
		{
			title: "Vendas",
			url: "/sales",
			icon: LineChart,
		},
		{
			title: "Configurações",
			url: "/settings",
			icon: Settings,
		},
	];

	const companyName = organization?.name ?? "Sem organização";
	const userName = currentUser?.name?.trim() || "Usuário";
	const userEmail = currentUser?.email ?? "Sem email";

	return (
		<Sidebar variant="inset">
			<SidebarHeader className="p-6">
				<div className="flex items-center gap-3 w-full">
					<div className="bg-green-500 rounded-md w-10 h-10 gradient-brand flex items-center justify-center">
						<img src={LogoBranco} alt="Logo Finax" />
					</div>
					<span className="text-xl font-bold text-white">Finax G.I</span>
				</div>
			</SidebarHeader>
			<Separator className="bg-gray-800" />
			<SidebarContent className="p-2">
				<SidebarGroup>
					<SidebarMenu>
						{items.map((item) => {
							if (!item.children) {
								return (
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton asChild onClick={item.action}>
											<Link to={item.url} className="p-6">
												<item.icon className="size-4" />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							}

							return (
								<Collapsible key={item.title} defaultOpen={false}>
									<SidebarMenuItem>
										<CollapsibleTrigger asChild>
											<SidebarMenuButton className="p-6 cursor-pointer">
												<item.icon className="size-4" />
												<span>{item.title}</span>
												<ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-90" />
											</SidebarMenuButton>
										</CollapsibleTrigger>

										<CollapsibleContent>
											<SidebarMenuSub>
												{item.children.map((child) => (
													<SidebarMenuSubItem key={child.title}>
														<SidebarMenuSubButton asChild>
															<Link to={child.url} className="p-4.5">
																<child.icon className="size-4" />
																<span>{child.title}</span>
															</Link>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												))}
											</SidebarMenuSub>
										</CollapsibleContent>
									</SidebarMenuItem>
								</Collapsible>
							);
						})}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter className="p-2">
				<Separator className="bg-gray-800" />

				<div className="px-2 py-2 space-y-1 group-data-[collapsible=icon]:hidden">
					<p className="text-xs text-gray-400 truncate min-w-0">{companyName}</p>
					<p className="text-sm font-medium text-white truncate min-w-0">{userName}</p>
					<p className="text-xs text-gray-400 truncate min-w-0">{userEmail}</p>
				</div>

				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							type="button"
							onClick={() => signOut.mutate()}
							disabled={signOut.isPending}
							tooltip="Sair"
							className="p-6 cursor-pointer"
						>
							<LogOut className="size-4" />
							<span className="group-data-[collapsible=icon]:hidden">
								{signOut.isPending ? "Saindo..." : "Sair"}
							</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
