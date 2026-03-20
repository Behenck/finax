import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, __dirname, "");
	const allowedHostsFromEnv = env.VITE_ALLOWED_HOSTS?.split(",")
		.map((host) => host.trim())
		.filter(Boolean);

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
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
		server: {
			allowedHosts: allowedHostsFromEnv?.length
				? allowedHostsFromEnv
				: ["web-production-47f75.up.railway.app"],
		},
		test: {
			environment: "jsdom",
			setupFiles: ["./tests/setup.ts"],
			include: ["tests/**/*.test.{ts,tsx}"],
		},
	};
});
