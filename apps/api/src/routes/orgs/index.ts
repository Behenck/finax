import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { createOrganization } from "./create-organization";
import { getMembership } from "./get-membership";
import { getOrganization } from "./get-organization";
import { getOrganizations } from "./get-organizations";
import { shutdownOrganization } from "./shutdown-organization";
import { updateOrganization } from "./update-organization";

function resolveOrganizationPermission(params: {
	method: string;
	routeUrl: string;
}) {
	const { method, routeUrl } = params;

	if (routeUrl === "/organization/:slug" && method === "GET") {
		return "settings.organization.view" as const;
	}

	if (routeUrl === "/organization/:slug" && method === "PUT") {
		return "settings.organization.update" as const;
	}

	return null;
}

export async function organizationRoutes(app: FastifyInstance) {
	registerModulePermissionGuard(app, resolveOrganizationPermission);

  await app.register(createOrganization);
  await app.register(getOrganization);
  await app.register(getOrganizations);
  await app.register(getMembership);
  await app.register(updateOrganization);
  await app.register(shutdownOrganization);
}
