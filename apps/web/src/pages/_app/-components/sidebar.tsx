import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Sidebar,
	SidebarContent,
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
import { useApp } from "@/context/app-context";
import { useAbility } from "@/permissions/access";

interface SidebarChildItem {
	title: string;
	url: string;
	icon: LucideIcon;
	match?: "exact" | "prefix";
	dashboardView?: "commercial" | "operational" | "partners";
	requiredPermission?: string;
	requiredAnyPermissions?: string[];
}

interface SidebarLeafItem {
	type: "leaf";
	title: string;
	url: string;
	icon: LucideIcon;
	match?: "exact" | "prefix";
	requiredPermission?: string;
	requiredAnyPermissions?: string[];
}

interface SidebarGroupItem {
	type: "group";
	title: string;
	icon: LucideIcon;
	children: SidebarChildItem[];
	requiredPermission?: string;
	requiredAnyPermissions?: string[];
}

type SidebarItem = SidebarLeafItem | SidebarGroupItem;

export function AppSidebar() {
	const { organization } = useApp();
	const ability = useAbility();
	const { state, isMobile, setOpenMobile } = useSidebar();
	const location = useLocation();
	const pathname = location.pathname;
	const isCollapsed = state === "collapsed";
	const previousPathnameRef = React.useRef(pathname);

	const items: SidebarItem[] = [
		{
			type: "group",
			title: "Dashboard",
			icon: Home,
			children: [
				{
					title: "Comercial",
					url: "/",
					icon: Home,
					match: "exact",
					dashboardView: "commercial",
				},
				{
					title: "Operacional",
					url: "/",
					icon: Building2,
					match: "exact",
					dashboardView: "operational",
				},
				{
					title: "Parceiros",
					url: "/",
					icon: UserRound,
					match: "exact",
					dashboardView: "partners",
				},
			],
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
					requiredPermission: "registers.customers.view",
				},
				{
					icon: UserRoundCheck,
					title: "Vendedores",
					url: "/registers/sellers",
					requiredPermission: "registers.sellers.view",
				},
				{
					icon: UserRound,
					title: "Parceiros",
					url: "/registers/partners",
					requiredPermission: "registers.partners.view",
				},
				{
					icon: Package,
					title: "Produtos",
					url: "/registers/products",
					requiredPermission: "registers.products.view",
				},
				{
					icon: Building2,
					title: "Empresas",
					url: "/registers/companies",
					requiredPermission: "registers.companies.view",
				},
				{
					icon: Landmark,
					title: "Centro de Custos",
					url: "/registers/cost-centers",
					requiredPermission: "registers.cost-centers.view",
				},
				{
					icon: Tags,
					title: "Categorias",
					url: "/registers/categories",
					requiredPermission: "registers.categories.view",
				},
				{
					icon: Briefcase,
					title: "Funcionários",
					url: "/registers/employees",
					requiredPermission: "registers.employees.view",
				},
			],
		},
		{
			type: "leaf",
			title: "Vendas",
			url: "/sales",
			icon: ShoppingCart,
			requiredPermission: "sales.view",
		},
		{
			type: "leaf",
			title: "Comissões",
			url: "/commissions",
			icon: Wallet,
			requiredPermission: "sales.view",
		},
		{
			type: "leaf",
			title: "Transações",
			url: "/transactions",
			icon: ArrowLeftRight,
			requiredPermission: "transactions.view",
		},
		{
			type: "leaf",
			title: "Configurações",
			url: "/settings",
			icon: Settings2,
			requiredAnyPermissions: [
				"settings.organization.view",
				"settings.members.view",
				"settings.permissions.manage",
			],
		},
	];

	const canAccessItem = (params: {
		requiredPermission?: string;
		requiredAnyPermissions?: string[];
	}) => {
		const { requiredPermission, requiredAnyPermissions } = params;
		const hasRequiredPermission = requiredPermission
			? ability.can("access", requiredPermission)
			: true;
		const hasAnyRequiredPermission =
			requiredAnyPermissions && requiredAnyPermissions.length > 0
				? requiredAnyPermissions.some((permissionKey) =>
						ability.can("access", permissionKey),
					)
				: true;

		return hasRequiredPermission && hasAnyRequiredPermission;
	};

	const visibleItems = items
		.map((item) => {
			if (item.type === "leaf") {
				return canAccessItem({
					requiredPermission: item.requiredPermission,
					requiredAnyPermissions: item.requiredAnyPermissions,
				})
					? item
					: null;
			}

			const visibleChildren = item.children.filter((child) =>
				canAccessItem({
					requiredPermission: child.requiredPermission,
					requiredAnyPermissions: child.requiredAnyPermissions,
				}),
			);

			if (
				visibleChildren.length === 0 ||
				!canAccessItem({
					requiredPermission: item.requiredPermission,
					requiredAnyPermissions: item.requiredAnyPermissions,
				})
			) {
				return null;
			}

			return {
				...item,
				children: visibleChildren,
			};
		})
		.filter((item): item is SidebarItem => item !== null);

	const companyName = organization?.name ?? "Sem organização";

	const isPathActive = React.useCallback(
		(url: string, match: "exact" | "prefix" = "prefix") => {
			if (match === "exact") {
				return pathname === url;
			}

			return pathname === url || pathname.startsWith(`${url}/`);
		},
		[pathname],
	);
	const dashboardView = React.useMemo(() => {
		const dashboardSearchValue = (location.search as { dashboard?: unknown })
			?.dashboard;
		if (
			dashboardSearchValue === "commercial" ||
			dashboardSearchValue === "operational" ||
			dashboardSearchValue === "partners"
		) {
			return dashboardSearchValue;
		}

		return "commercial";
	}, [location.search]);
	const isChildActive = React.useCallback(
		(child: SidebarChildItem) => {
			if (child.dashboardView) {
				return (
					isPathActive(child.url, child.match ?? "exact") &&
					dashboardView === child.dashboardView
				);
			}

			return isPathActive(child.url, child.match);
		},
		[dashboardView, isPathActive],
	);

	const dashboardItem = visibleItems.find(
		(item): item is SidebarGroupItem =>
			item.type === "group" && item.title === "Dashboard",
	);
	const isDashboardActive =
		dashboardItem?.children.some((child) => isChildActive(child)) ?? false;
	const [isDashboardOpen, setIsDashboardOpen] =
		React.useState<boolean>(isDashboardActive);

	const registersItem = visibleItems.find(
		(item): item is SidebarGroupItem =>
			item.type === "group" && item.title === "Cadastros",
	);
	const isRegistersActive =
		registersItem?.children.some((child) => isChildActive(child)) ?? false;
	const [isRegistersOpen, setIsRegistersOpen] =
		React.useState<boolean>(isRegistersActive);

	React.useEffect(() => {
		if (isCollapsed) {
			setIsDashboardOpen(false);
			setIsRegistersOpen(false);
			return;
		}

		if (isDashboardActive) {
			setIsDashboardOpen(true);
		}

		if (isRegistersActive) {
			setIsRegistersOpen(true);
		}
	}, [isCollapsed, isDashboardActive, isRegistersActive]);

	React.useEffect(() => {
		if (!isMobile) {
			previousPathnameRef.current = pathname;
			return;
		}

		if (previousPathnameRef.current !== pathname) {
			setOpenMobile(false);
		}

		previousPathnameRef.current = pathname;
	}, [isMobile, pathname, setOpenMobile]);

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
						className="hidden size-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:inline-flex"
						title={isCollapsed ? "Expandir menu" : "Recolher menu"}
					/>
				</div>
			</SidebarHeader>
			<Separator className="bg-sidebar-border/70" />
			<SidebarContent className="px-2 py-2">
				<SidebarGroup>
					<SidebarMenu className="gap-1">
						{visibleItems.map((item) => {
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
									open={item.title === "Dashboard" ? isDashboardOpen : isRegistersOpen}
									onOpenChange={
										item.title === "Dashboard"
											? setIsDashboardOpen
											: setIsRegistersOpen
									}
								>
									<SidebarMenuItem>
										<CollapsibleTrigger asChild>
											<SidebarMenuButton
												isActive={
													item.title === "Dashboard"
														? isDashboardActive
														: isRegistersActive
												}
												tooltip={
													isCollapsed
														? `Expanda a sidebar para acessar ${item.title}`
														: item.title
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
																isActive={isChildActive(child)}
															>
																<Link
																	to={
																		child.dashboardView
																			? `${child.url}?dashboard=${child.dashboardView}`
																			: child.url
																	}
																	className="h-8 px-2"
																>
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
			<SidebarRail />
		</Sidebar>
	);
}
