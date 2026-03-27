import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dashboardViewParser } from "@/hooks/filters/parsers";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryState } from "nuqs";
import { DashboardCommercialOverview } from "./-components/dashboard-commercial-overview";
import { DashboardOperationalOverview } from "./-components/dashboard-operational-overview";

export const Route = createFileRoute("/_app/_dashboard/")({
	component: DashboardPage,
});

function DashboardPage() {
	const [dashboardView, setDashboardView] = useQueryState(
		"dashboard",
		dashboardViewParser,
	);

	return (
		<main className="w-full space-y-6">
			<section className="space-y-3">
				<Tabs
					value={dashboardView}
					onValueChange={(value) =>
						void setDashboardView(value as "commercial" | "operational")
					}
				>
					<TabsList className="rounded-full bg-muted p-1">
						<TabsTrigger value="commercial" className="rounded-full px-4">
							Vendas e comissões do mês
						</TabsTrigger>
						<TabsTrigger value="operational" className="rounded-full px-4">
							Base operacional
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</section>

			{dashboardView === "commercial" ? (
				<DashboardCommercialOverview />
			) : (
				<section className="space-y-5">
					<div className="space-y-1">
						<h2 className="text-xl font-semibold text-foreground">
							Base operacional
						</h2>
						<p className="text-sm text-muted-foreground">
							Contexto cadastral e estrutural da organização para apoiar a operação.
						</p>
					</div>

					<DashboardOperationalOverview />
				</section>
			)}
		</main>
	);
}
