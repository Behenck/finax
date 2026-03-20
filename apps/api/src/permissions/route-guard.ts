import type { FastifyInstance } from "fastify";
import type { PermissionKey } from "./catalog";
import { requireRequestAnyPermission, requireRequestPermission } from "./request";

type PermissionResolver = (params: {
	method: string;
	routeUrl: string;
}) => PermissionKey | readonly PermissionKey[] | null;

function normalizeRouteUrl(routeUrl: string) {
	return routeUrl.split("?")[0] ?? routeUrl;
}

function isPermissionList(
	value: PermissionKey | readonly PermissionKey[],
): value is readonly PermissionKey[] {
	return Array.isArray(value);
}

export function registerModulePermissionGuard(
	app: FastifyInstance,
	resolvePermission: PermissionResolver,
) {
	app.addHook("preHandler", async (request) => {
		const slug = (request.params as { slug?: string } | undefined)?.slug;
		if (!slug) {
			return;
		}

		const permissionRequirement = resolvePermission({
			method: request.method.toUpperCase(),
			routeUrl: normalizeRouteUrl(request.routeOptions.url ?? ""),
		});

		if (!permissionRequirement) {
			return;
		}

		if (isPermissionList(permissionRequirement)) {
			await requireRequestAnyPermission(request, slug, permissionRequirement);
			return;
		}

		await requireRequestPermission(request, slug, permissionRequirement);
	});
}
