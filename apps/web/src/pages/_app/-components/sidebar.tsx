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
	SidebarRail,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	ArrowLeftRight,
	Briefcase,
	Building2,
	Building,
	ChevronRight,
	Home,
	LogOut,
	Package,
	Settings2,
	ShoppingCart,
	Tags,
	UserRound,
	UserRoundCheck,
	Users,
	Wallet,
	Landmark,
	type LucideIcon,
} from "lucide-react";
import * as React from "react";
import LogoBranco from "@/assets/logo-finax-branco.png";
import { Separator } from "@/components/ui/separator";
import { Link, useLocation } from "@tanstack/react-router";
import { auth } from "@/hooks/auth";
import { useApp } from "@/context/app-context";

interface SidebarChildItem {
	title: string;
	url: string;
	icon: LucideIcon;
}

interface SidebarLeafItem {
	type: "leaf";
	title: string;
	url: string;
	icon: LucideIcon;
	match?: "exact" | "prefix";
}

interface SidebarGroupItem {
	type: "group";
	title: string;
	icon: LucideIcon;
	children: SidebarChildItem[];
}

type SidebarItem = SidebarLeafItem | SidebarGroupItem;

export function AppSidebar() {
	const { organization, auth: currentUser } = useApp();
	const { state } = useSidebar();
	const location = useLocation();
	const signOut = auth.useSignOut();
	const pathname = location.pathname;
	const isCollapsed = state === "collapsed";

	const items: SidebarItem[] = [
		{
			type: "leaf",
			title: "Dashboard",
			url: "/",
			icon: Home,
			match: "exact",
		},
		{
			type: "leaf",
			title: "Vendas",
			url: "/sales",
			icon: ShoppingCart,
		},
		{
			type: "leaf",
			title: "Comissões",
			url: "/commissions",
			icon: Wallet,
		},
		{
			type: "leaf",
			title: "Transações",
			url: "/transactions",
			icon: ArrowLeftRight,
		},
		{
			type: "group",
			title: "Cadastros",
			icon: Building,
			children: [
				{
					icon: Users,
					title: "Clientes",
					url: "/registers/customers",
				},
				{
					icon: UserRoundCheck,
					title: "Vendedores",
					url: "/registers/sellers",
				},
				{
					icon: UserRound,
					title: "Parceiros",
					url: "/registers/partners",
				},
				{
					icon: Package,
					title: "Produtos",
					url: "/registers/products",
				},
				{
					icon: Building2,
					title: "Empresas",
					url: "/registers/companies",
				},
				{
					icon: Landmark,
					title: "Centro de Custos",
					url: "/registers/cost-centers",
				},
				{
					icon: Tags,
					title: "Categorias",
					url: "/registers/categories",
				},
				{
					icon: Briefcase,
					title: "Funcionários",
					url: "/registers/employees",
				},
			],
		},
		{
			type: "leaf",
			title: "Configurações",
			url: "/settings",
			icon: Settings2,
		},
	];

	const companyName = organization?.name ?? "Sem organização";
	const userName = currentUser?.name?.trim() || "Usuário";
	const userEmail = currentUser?.email ?? "Sem email";
	const userInitials = React.useMemo(() => {
		const parts = userName.split(" ").filter(Boolean).slice(0, 2);
		const initials = parts.map((part) => part.at(0)?.toUpperCase() ?? "").join("");
		return initials || "U";
	}, [userName]);

	const isPathActive = React.useCallback(
		(url: string, match: "exact" | "prefix" = "prefix") => {
			if (match === "exact") {
				return pathname === url;
			}

			return pathname === url || pathname.startsWith(`${url}/`);
		},
		[pathname],
	);

	const registersItem = items.find(
		(item): item is SidebarGroupItem =>
			item.type === "group" && item.title === "Cadastros",
	);
	const isRegistersActive =
		registersItem?.children.some((child) => isPathActive(child.url)) ?? false;
	const [isRegistersOpen, setIsRegistersOpen] =
		React.useState<boolean>(isRegistersActive);

	React.useEffect(() => {
		if (isCollapsed) {
			setIsRegistersOpen(false);
			return;
		}

		if (isRegistersActive) {
			setIsRegistersOpen(true);
		}
	}, [isCollapsed, isRegistersActive]);

	return (
		<Sidebar variant="inset" collapsible="icon">
			<SidebarHeader className="px-3 py-3">
				<div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
					<Link
						to="/"
						className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent/70 group-data-[collapsible=icon]:hidden"
					>
						<div className="gradient-brand flex size-9 items-center justify-center rounded-md">
							<img src={LogoBranco} alt="Logo Finax" className="h-5 w-5" />
						</div>
						<div className="min-w-0 group-data-[collapsible=icon]:hidden">
							<p className="truncate text-sm font-semibold text-sidebar-foreground">
								Finax G.I
							</p>
							<p className="truncate text-xs text-sidebar-foreground/60">
								{companyName}
							</p>
						</div>
					</Link>
					<SidebarTrigger
						className="size-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
						title={isCollapsed ? "Expandir menu" : "Recolher menu"}
					/>
				</div>
			</SidebarHeader>
			<Separator className="bg-sidebar-border/70" />
			<SidebarContent className="px-2 py-2">
				<SidebarGroup>
					<SidebarMenu className="gap-1">
						{items.map((item) => {
							if (item.type === "leaf") {
								const isActive = isPathActive(item.url, item.match);
								return (
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton
											asChild
											isActive={isActive}
											tooltip={item.title}
											className="h-9 rounded-lg px-3 text-sidebar-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
										>
											<Link to={item.url}>
												<item.icon className="size-4" />
												<span className="group-data-[collapsible=icon]:hidden">
													{item.title}
												</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							}

							return (
								<Collapsible
									key={item.title}
									open={isRegistersOpen}
									onOpenChange={setIsRegistersOpen}
								>
									<SidebarMenuItem>
										<CollapsibleTrigger asChild>
											<SidebarMenuButton
												isActive={isRegistersActive}
												tooltip={
													isCollapsed
														? "Expanda a sidebar para acessar Cadastros"
														: "Cadastros"
												}
												className="h-9 cursor-pointer rounded-lg px-3 text-sidebar-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
												onClick={(event) => {
													if (!isCollapsed) {
														return;
													}

													event.preventDefault();
												}}
											>
												<item.icon className="size-4" />
												<span className="group-data-[collapsible=icon]:hidden">
													{item.title}
												</span>
												<ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]:rotate-90 group-data-[collapsible=icon]:hidden" />
											</SidebarMenuButton>
										</CollapsibleTrigger>

										<CollapsibleContent className="group-data-[collapsible=icon]:hidden">
											<SidebarMenuSub>
												{item.children.map((child) => (
													<SidebarMenuSubItem key={child.title}>
														<SidebarMenuSubButton
															asChild
															isActive={isPathActive(child.url)}
														>
															<Link to={child.url} className="h-8 px-2">
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
			<SidebarFooter className="px-2 pb-2">
				<Separator className="bg-sidebar-border/70" />

				<div className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
					<Link
						to="/profile"
						className="focus-visible:ring-ring/50 flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-xs font-semibold text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent/80 focus-visible:ring-2"
						title="Meu perfil"
					>
						{userInitials}
					</Link>
					<div className="min-w-0 group-data-[collapsible=icon]:hidden">
						<Link
							to="/profile"
							className="focus-visible:ring-ring/50 block truncate rounded-sm text-sm font-medium text-sidebar-foreground outline-none transition-colors hover:text-sidebar-primary focus-visible:ring-2"
						>
							{userName}
						</Link>
						<p className="truncate text-xs text-sidebar-foreground/60">{companyName}</p>
					</div>
				</div>

				<div className="mt-1 px-3 py-1 group-data-[collapsible=icon]:hidden">
					<p className="truncate text-xs text-sidebar-foreground/70">{userEmail}</p>
				</div>

				<SidebarMenu className="mt-2">
					<SidebarMenuItem>
						<SidebarMenuButton
							type="button"
							onClick={() => signOut.mutate()}
							disabled={signOut.isPending}
							tooltip="Sair"
							className="h-9 cursor-pointer rounded-lg px-3 text-sidebar-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
						>
							<LogOut className="size-4" />
							<span className="group-data-[collapsible=icon]:hidden">
								{signOut.isPending ? "Saindo..." : "Sair"}
							</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
