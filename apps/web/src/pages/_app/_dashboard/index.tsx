import { createFileRoute } from "@tanstack/react-router";
import { DashboardPartnersOverview } from "./-components/dashboard-partners-overview";

export const Route = createFileRoute("/_app/_dashboard/")({
	component: DashboardPage,
});

function DashboardPage() {
	return (
		<main className="w-full space-y-6">
			<DashboardPartnersOverview />
		</main>
	);
}
