import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { loadEnv } from "vite";

function parseAllowedHosts(hosts?: string) {
	if (!hosts) {
		return [];
	}

	return hosts
		.split(",")
		.map((host) => host.trim())
		.map((host) => {
			if (!host) {
				return "";
			}

			const normalizedHost = host.replace(/^['"]|['"]$/g, "");

			try {
				if (normalizedHost.includes("://")) {
					return new URL(normalizedHost).hostname;
				}
			} catch {
				// Keep original value when parsing URL fails.
			}

			return normalizedHost
				.replace(/\/.*$/, "")
				.replace(/:\d+$/, "");
		})
		.filter(Boolean);
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, __dirname, "");
	const hostsFromEnv = env.VITE_ALLOWED_HOSTS ?? process.env.VITE_ALLOWED_HOSTS;
	const normalizedHostsFromEnv = hostsFromEnv?.trim();
	const railwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
	const allowedHosts =
		!normalizedHostsFromEnv || normalizedHostsFromEnv === "true"
			? true
			: Array.from(
					new Set([
						...parseAllowedHosts(normalizedHostsFromEnv),
						...(railwayPublicDomain ? [railwayPublicDomain] : []),
						".up.railway.app",
					]),
				);

	return {
		plugins: [
			tanstackRouter({
				target: "react",
				autoCodeSplitting: true,
				generatedRouteTree: "./src/route-tree.gen.ts",
				routesDirectory: "./src/pages",
				routeToken: "layout",
			}),
			react(),
			tailwindcss(),
		],
		resolve: {
			dedupe: ["react", "react-dom"],
			alias: {
				"@": path.resolve(__dirname, "./src"),
				react: path.resolve(__dirname, "./node_modules/react"),
				"react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
				"react/jsx-runtime": path.resolve(
					__dirname,
					"./node_modules/react/jsx-runtime.js",
				),
				"react/jsx-dev-runtime": path.resolve(
					__dirname,
					"./node_modules/react/jsx-dev-runtime.js",
				),
			},
		},
		optimizeDeps: {
			include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
		},
		server: {
			allowedHosts,
		},
		preview: {
			allowedHosts,
		},
		test: {
			environment: "jsdom",
			setupFiles: ["./tests/setup.ts"],
			include: ["tests/**/*.test.{ts,tsx}"],
		},
	};
});
