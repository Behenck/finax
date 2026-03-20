import { SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { AppContext } from "@/context/app-context";
import { auth } from "@/hooks/auth";
import { PermissionsProvider } from "@/permissions/provider";
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import Cookies from "js-cookie";
import { AppTopHeader } from "./-components/app-top-header";
import { AppSidebar } from "./-components/sidebar";
import { QuickActionsCommand } from "./-components/quick-actions-command";
export const Route = createFileRoute("/_app")({
	component: AppLayout,
});

function AppLayout() {
	const { data, isPending } = auth.useSession();
	const token = Cookies.get("token");

	if (!token) {
		return <Navigate to="/sign-in" replace />;
	}

	if (isPending) {
		return <Skeleton />;
	}

	if (data == null) {
		return <Navigate to="/sign-in" replace />;
	}
	return (
		<PermissionsProvider effectivePermissions={data.effectivePermissions}>
			<AppContext.Provider
				value={{
					auth: data.user,
					membership: data.organization.role,
					organization: data.organization,
					effectivePermissions: data.effectivePermissions,
				}}
			>
				<SidebarProvider>
					<AppSidebar />
					<QuickActionsCommand />

					<main className="flex-1 bg-gray-50">
						<AppTopHeader />
						<div className="px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-10 lg:py-10">
							<Outlet />
						</div>
					</main>
				</SidebarProvider>
			</AppContext.Provider>
		</PermissionsProvider>
	);
}
