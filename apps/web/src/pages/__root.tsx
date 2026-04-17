import {
	HeadContent,
	Outlet,
	createRootRoute,
	useRouterState,
} from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import React from "react";
import { resolvePageTitle } from "@/lib/page-title";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	return (
		<React.Fragment>
			<HeadContent />
			<DocumentTitle />
			<NuqsAdapter>
				<Outlet />
			</NuqsAdapter>
		</React.Fragment>
	);
}

function DocumentTitle() {
	const location = useRouterState({
		select: (state) => state.location,
	});

	React.useEffect(() => {
		document.title = resolvePageTitle(location.pathname, location.search);
	}, [location.pathname, location.search]);

	return null;
}
