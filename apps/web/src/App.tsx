import { Component, type ReactNode } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { router } from "./router";

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});

type ToasterErrorBoundaryProps = {
	children: ReactNode;
};

type ToasterErrorBoundaryState = {
	hasError: boolean;
};

class ToasterErrorBoundary extends Component<
	ToasterErrorBoundaryProps,
	ToasterErrorBoundaryState
> {
	state: ToasterErrorBoundaryState = {
		hasError: false,
	};

	static getDerivedStateFromError(): ToasterErrorBoundaryState {
		return { hasError: true };
	}

	componentDidCatch(error: unknown) {
		console.error("Falha ao renderizar Toaster (sonner):", error);
	}

	render() {
		if (this.state.hasError) {
			return null;
		}

		return this.props.children;
	}
}

function SafeToaster() {
	return (
		<ToasterErrorBoundary>
			<Toaster />
		</ToasterErrorBoundary>
	);
}

export function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				enableSystem
				disableTransitionOnChange
			>
				<RouterProvider router={router} />
				<SafeToaster />
				{import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
			</ThemeProvider>
		</QueryClientProvider>
	);
}
