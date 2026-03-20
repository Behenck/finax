import { prisma } from "@/lib/prisma";
import { BadRequestError } from "@/routes/_errors/bad-request-error";
import type { Prisma } from "generated/prisma/client";
import {
	PermissionAuditChangeType,
	PermissionOverrideEffect,
	Role,
} from "generated/prisma/enums";
import { PERMISSION_CATALOG } from "./catalog";

type PrismaContext = Prisma.TransactionClient | typeof prisma;
type OrganizationRole = (typeof Role)[keyof typeof Role];
type OverrideEffect = (typeof PermissionOverrideEffect)[keyof typeof PermissionOverrideEffect];

const ORGANIZATION_ROLES = Object.values(Role) as OrganizationRole[];

type ActivePermission = {
	id: string;
	key: string;
	module: string;
	action: string;
	description: string | null;
	isActive: boolean;
};

async function syncPermissionCatalog(ctx: PrismaContext) {
	for (const permission of PERMISSION_CATALOG) {
		await ctx.permission.upsert({
			where: {
				key: permission.key,
			},
			create: {
				key: permission.key,
				module: permission.module,
				action: permission.action,
				description: permission.description,
				isActive: true,
			},
			update: {
				module: permission.module,
				action: permission.action,
				description: permission.description,
			},
		});
	}
}

async function getActivePermissions(ctx: PrismaContext): Promise<ActivePermission[]> {
	await syncPermissionCatalog(ctx);

	return ctx.permission.findMany({
		where: {
			isActive: true,
		},
		select: {
			id: true,
			key: true,
			module: true,
			action: true,
			description: true,
			isActive: true,
		},
		orderBy: [{ module: "asc" }, { key: "asc" }],
	});
}

async function ensureOrganizationRolePermissionRows(
	ctx: PrismaContext,
	organizationId: string,
	activePermissions: ActivePermission[],
) {
	if (activePermissions.length === 0) {
		return;
	}

	await ctx.organizationRolePermission.createMany({
		data: ORGANIZATION_ROLES.flatMap((role) =>
			activePermissions.map((permission) => ({
				organizationId,
				role,
				permissionId: permission.id,
				allowed: true,
			})),
		),
		skipDuplicates: true,
	});
}

function mapPermissionKeysToIds(activePermissions: ActivePermission[]) {
	return new Map(activePermissions.map((permission) => [permission.key, permission.id]));
}

function mapPermissionIdsToKeys(activePermissions: ActivePermission[]) {
	return new Map(activePermissions.map((permission) => [permission.id, permission.key]));
}

function resolveEffectivePermissionIds(params: {
	isOwner: boolean;
	activePermissions: ActivePermission[];
	roleAllowedPermissionIds: Set<string>;
	overrides: Array<{ permissionId: string; effect: OverrideEffect }>;
}) {
	const {
		isOwner,
		activePermissions,
		roleAllowedPermissionIds,
		overrides,
	} = params;

	if (isOwner) {
		return new Set(activePermissions.map((permission) => permission.id));
	}

	const effectivePermissionIds = new Set(roleAllowedPermissionIds);
	for (const override of overrides) {
		if (override.effect === PermissionOverrideEffect.DENY) {
			effectivePermissionIds.delete(override.permissionId);
			continue;
		}

		effectivePermissionIds.add(override.permissionId);
	}

	return effectivePermissionIds;
}

function toSortedPermissionKeys(
	permissionIds: Set<string>,
	activePermissions: ActivePermission[],
) {
	const permissionKeyById = mapPermissionIdsToKeys(activePermissions);
	return Array.from(permissionIds)
		.map((permissionId) => permissionKeyById.get(permissionId))
		.filter((permissionKey): permissionKey is string => Boolean(permissionKey))
		.sort((first, second) => first.localeCompare(second));
}

async function loadRolePresetAssignments(params: {
	ctx: PrismaContext;
	organizationId: string;
	role: OrganizationRole;
	activePermissions: ActivePermission[];
}) {
	const { ctx, organizationId, role, activePermissions } = params;

	const rolePermissions = await ctx.organizationRolePermission.findMany({
		where: {
			organizationId,
			role,
			permissionId: {
				in: activePermissions.map((permission) => permission.id),
			},
		},
		select: {
			permissionId: true,
			allowed: true,
		},
	});

	const assignmentByPermissionId = new Map(
		rolePermissions.map((assignment) => [assignment.permissionId, assignment.allowed]),
	);

	return activePermissions.map((permission) => ({
		permissionId: permission.id,
		permissionKey: permission.key,
		module: permission.module,
		action: permission.action,
		description: permission.description,
		allowed: assignmentByPermissionId.get(permission.id) ?? true,
	}));
}

async function loadMemberOverrides(params: {
	ctx: PrismaContext;
	organizationId: string;
	memberId: string;
	activePermissions: ActivePermission[];
}) {
	const { ctx, organizationId, memberId, activePermissions } = params;

	const overrides = await ctx.memberPermissionOverride.findMany({
		where: {
			organizationId,
			memberId,
			permissionId: {
				in: activePermissions.map((permission) => permission.id),
			},
		},
		select: {
			permissionId: true,
			effect: true,
			permission: {
				select: {
					key: true,
				},
			},
		},
		orderBy: {
			permission: {
				key: "asc",
			},
		},
	});

	return overrides.map((override) => ({
		permissionId: override.permissionId,
		permissionKey: override.permission.key,
		effect: override.effect,
	}));
}

export async function resolveEffectivePermissions(params: {
	organizationId: string;
	memberId: string;
	role: OrganizationRole;
	userId: string;
	ownerId?: string;
	ctx?: PrismaContext;
}) {
	const ctx = params.ctx ?? prisma;
	const activePermissions = await getActivePermissions(ctx);
	await ensureOrganizationRolePermissionRows(
		ctx,
		params.organizationId,
		activePermissions,
	);

	const ownerId =
		params.ownerId ??
		(
			await ctx.organization.findUnique({
				where: {
					id: params.organizationId,
				},
				select: {
					ownerId: true,
				},
			})
		)?.ownerId;

	if (!ownerId) {
		throw new BadRequestError("Organization not found");
	}

	const [rolePermissions, overrides] = await Promise.all([
		ctx.organizationRolePermission.findMany({
			where: {
				organizationId: params.organizationId,
				role: params.role,
				allowed: true,
				permissionId: {
					in: activePermissions.map((permission) => permission.id),
				},
			},
			select: {
				permissionId: true,
			},
		}),
		ctx.memberPermissionOverride.findMany({
			where: {
				organizationId: params.organizationId,
				memberId: params.memberId,
				permissionId: {
					in: activePermissions.map((permission) => permission.id),
				},
			},
			select: {
				permissionId: true,
				effect: true,
			},
		}),
	]);

	const roleAllowedPermissionIds = new Set(
		rolePermissions.map((permission) => permission.permissionId),
	);
	const effectivePermissionIds = resolveEffectivePermissionIds({
		isOwner: params.userId === ownerId,
		activePermissions,
		roleAllowedPermissionIds,
		overrides,
	});

	return toSortedPermissionKeys(effectivePermissionIds, activePermissions);
}

export async function getPermissionCatalog(ctx: PrismaContext = prisma) {
	return getActivePermissions(ctx);
}

export async function getMemberPermissionDetails(params: {
	organizationId: string;
	memberId: string;
	ctx?: PrismaContext;
}) {
	const ctx = params.ctx ?? prisma;
	const member = await ctx.member.findFirst({
		where: {
			id: params.memberId,
			organizationId: params.organizationId,
		},
		select: {
			id: true,
			role: true,
			userId: true,
			user: {
				select: {
					name: true,
					email: true,
				},
			},
		},
	});

	if (!member) {
		throw new BadRequestError("Member not found");
	}

	const activePermissions = await getActivePermissions(ctx);
	await ensureOrganizationRolePermissionRows(ctx, params.organizationId, activePermissions);

	const [presetAssignments, overrides, effectivePermissions] = await Promise.all([
		loadRolePresetAssignments({
			ctx,
			organizationId: params.organizationId,
			role: member.role,
			activePermissions,
		}),
		loadMemberOverrides({
			ctx,
			organizationId: params.organizationId,
			memberId: params.memberId,
			activePermissions,
		}),
		resolveEffectivePermissions({
			organizationId: params.organizationId,
			memberId: params.memberId,
			role: member.role,
			userId: member.userId,
			ctx,
		}),
	]);

	return {
		member: {
			id: member.id,
			userId: member.userId,
			role: member.role,
			name: member.user.name,
			email: member.user.email,
		},
		presetPermissions: presetAssignments
			.filter((permission) => permission.allowed)
			.map((permission) => permission.permissionKey)
			.sort((first, second) => first.localeCompare(second)),
		overrides: overrides.map((override) => ({
			permissionKey: override.permissionKey,
			effect: override.effect,
		})),
		effectivePermissions,
	};
}

export async function replaceMemberPermissionOverrides(params: {
	organizationId: string;
	memberId: string;
	overrides: Array<{
		permissionKey: string;
		effect: OverrideEffect;
	}>;
	actorUserId: string;
}) {
	return prisma.$transaction(async (tx) => {
		const member = await tx.member.findFirst({
			where: {
				id: params.memberId,
				organizationId: params.organizationId,
			},
			select: {
				id: true,
				role: true,
				userId: true,
			},
		});

		if (!member) {
			throw new BadRequestError("Member not found");
		}

		const activePermissions = await getActivePermissions(tx);
		await ensureOrganizationRolePermissionRows(tx, params.organizationId, activePermissions);
		const permissionIdByKey = mapPermissionKeysToIds(activePermissions);
		const normalizedOverridesByKey = new Map<string, OverrideEffect>();

		for (const override of params.overrides) {
			if (!permissionIdByKey.has(override.permissionKey)) {
				throw new BadRequestError(
					`Invalid or inactive permission key: ${override.permissionKey}`,
				);
			}

			if (normalizedOverridesByKey.has(override.permissionKey)) {
				throw new BadRequestError(
					`Duplicate override for permission key: ${override.permissionKey}`,
				);
			}

			normalizedOverridesByKey.set(override.permissionKey, override.effect);
		}

		const beforeOverrides = await loadMemberOverrides({
			ctx: tx,
			organizationId: params.organizationId,
			memberId: params.memberId,
			activePermissions,
		});

		await tx.memberPermissionOverride.deleteMany({
			where: {
				organizationId: params.organizationId,
				memberId: params.memberId,
			},
		});

		if (normalizedOverridesByKey.size > 0) {
			await tx.memberPermissionOverride.createMany({
				data: Array.from(normalizedOverridesByKey.entries()).map(
					([permissionKey, effect]) => ({
						memberId: params.memberId,
						organizationId: params.organizationId,
						permissionId: permissionIdByKey.get(permissionKey)!,
						effect,
					}),
				),
			});
		}

		const afterOverrides = await loadMemberOverrides({
			ctx: tx,
			organizationId: params.organizationId,
			memberId: params.memberId,
			activePermissions,
		});
		const effectivePermissions = await resolveEffectivePermissions({
			organizationId: params.organizationId,
			memberId: params.memberId,
			role: member.role,
			userId: member.userId,
			ctx: tx,
		});

		await tx.permissionAuditLog.create({
			data: {
				organizationId: params.organizationId,
				actorUserId: params.actorUserId,
				targetMemberId: params.memberId,
				changeType: PermissionAuditChangeType.MEMBER_OVERRIDE_REPLACED,
				before: {
					overrides: beforeOverrides.map((override) => ({
						permissionKey: override.permissionKey,
						effect: override.effect,
					})),
				},
				after: {
					overrides: afterOverrides.map((override) => ({
						permissionKey: override.permissionKey,
						effect: override.effect,
					})),
					effectivePermissions,
				},
			},
		});

		return {
			beforeOverrides,
			afterOverrides,
			effectivePermissions,
		};
	});
}
