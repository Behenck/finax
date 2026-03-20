import "fastify";

import type { PermissionKey } from "@/permissions/catalog";
import type { Organization } from "@prisma/client";
import { MemberDataScope, Role } from "generated/prisma/enums";

type AuthMembership = {
	id: string;
	role: (typeof Role)[keyof typeof Role];
	organizationId: string;
	userId: string;
	customersScope: (typeof MemberDataScope)[keyof typeof MemberDataScope];
	salesScope: (typeof MemberDataScope)[keyof typeof MemberDataScope];
	commissionsScope: (typeof MemberDataScope)[keyof typeof MemberDataScope];
};

declare module "fastify" {
  export interface FastifyRequest {
    getCurrentUserId(): Promise<string>;
    getUserMembership(
      slug: string
    ): Promise<{ organization: Organization; membership: AuthMembership }>;
    getEffectivePermissions(slug: string): Promise<string[]>;
    hasPermission(
      slug: string,
      permissionKey: PermissionKey | string
    ): Promise<boolean>;
    requirePermission(
      slug: string,
      permissionKey: PermissionKey | string
    ): Promise<void>;
  }
}
