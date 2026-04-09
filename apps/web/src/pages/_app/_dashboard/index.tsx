import { dashboardViewParser } from "@/hooks/filters/parsers";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryState } from "nuqs";
import { DashboardCommercialOverview } from "./-components/dashboard-commercial-overview";
import { DashboardOperationalOverview } from "./-components/dashboard-operational-overview";
import { DashboardPartnersOverview } from "./-components/dashboard-partners-overview";

export const Route = createFileRoute("/_app/_dashboard/")({
	component: DashboardPage,
});

function DashboardPage() {
	const [dashboardView] = useQueryState("dashboard", dashboardViewParser);

	return (
		<main className="w-full space-y-6">
			{dashboardView === "commercial" ? <DashboardCommercialOverview /> : null}

			{dashboardView === "operational" ? (
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
			) : null}

			{dashboardView === "partners" ? <DashboardPartnersOverview /> : null}
		</main>
	);
}
