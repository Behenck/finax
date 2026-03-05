import { HeadContent, Outlet, createRootRoute } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import React from "react";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	return (
		<React.Fragment>
			<HeadContent />
			<NuqsAdapter>
				<Outlet />
			</NuqsAdapter>
		</React.Fragment>
	);
}
