import type { FastifyInstance } from "fastify";
import { getPermissionsCatalog } from "./get-permissions-catalog";
import { getMemberPermissions } from "./get-member-permissions";
import { putMemberPermissions } from "./put-member-permissions";

export async function permissionRoutes(app: FastifyInstance) {
	await app.register(getPermissionsCatalog);
	await app.register(getMemberPermissions);
	await app.register(putMemberPermissions);
}
