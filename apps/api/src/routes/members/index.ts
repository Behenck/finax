import type { FastifyInstance } from "fastify";
import { registerModulePermissionGuard } from "@/permissions/route-guard";
import { getMembers } from "./get-members";
import { removeMember } from "./remove-member";
import { updateMember } from "./update-member";
import { getMembersRole } from "./get-members-role";
import { updateMemberRole } from "./update-member-role";

function resolveMembersPermission(params: { method: string; routeUrl: string }) {
  const { method, routeUrl } = params;

  if (
    routeUrl === "/organizations/:slug/members" ||
    routeUrl === "/organizations/:slug/members/:role"
  ) {
    if (method === "GET") {
      return "settings.members.view" as const;
    }

    return null;
  }

  if (
    routeUrl === "/organizations/:slug/members/:memberId" ||
    routeUrl === "/organizations/:slug/members/:memberId/role"
  ) {
    if (method === "DELETE" || method === "PATCH" || method === "PUT") {
      return "settings.members.manage" as const;
    }
  }

  return null;
}

export async function memberRoutes(app: FastifyInstance) {
  registerModulePermissionGuard(app, resolveMembersPermission);

  await app.register(getMembers);
  await app.register(getMembersRole);
  await app.register(removeMember);
  await app.register(updateMemberRole);
  await app.register(updateMember);
}
