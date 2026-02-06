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
	ChartPie,
	ChevronRight,
	Circle,
	CreditCard,
	Database,
	Home,
	IdCardLanyard,
	Network,
	Settings,
	Tags,
	Target,
	TriangleAlert,
	User,
	Users,
	type LucideIcon,
} from "lucide-react";
import LogoBranco from "@/assets/logo-finax-branco.png";
import { Separator } from "@/components/ui/separator";
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";

interface ItemsProps {
	title: string;
	url: string;
	icon: LucideIcon;
	children?: {
		title: string;
		url: string;
		icon: LucideIcon;
	}[];
}

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
				icon: Tags,
				title: "Categorias",
				url: "/registers/categories",
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
		title: "Orçamentos",
		url: "#",
		icon: ChartPie,
	},
	{
		title: "Dívidas",
		url: "#",
		icon: TriangleAlert,
	},
	{
		title: "Metas",
		url: "#",
		icon: Target,
	},
	{
		title: "Família",
		url: "#",
		icon: Users,
	},
	{
		title: "Configurações",
		url: "/settings",
		icon: Settings,
	},
	{
		title: "Perfil",
		url: "#",
		icon: User,
	},
];

export function AppSidebar() {
	return (
		<Sidebar>
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
										<SidebarMenuButton asChild>
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
															<Link to={child.url} className="p-4">
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
			<SidebarFooter />
		</Sidebar>
	);
}
