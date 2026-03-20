import type { FastifyRequest } from "fastify";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/routes/_errors/forbidden-error";
import { UnauthorizedError } from "@/routes/_errors/unauthorized-error";
import type { PermissionKey } from "./catalog";
import { resolveEffectivePermissions } from "./service";

type PermissionContext = {
	userId: string;
	memberId: string;
	role: string;
	organizationId: string;
	ownerId: string;
	effectivePermissions: Set<string>;
};

const requestContextCache = new WeakMap<
	FastifyRequest,
	Map<string, PermissionContext>
>();

function getRequestContextMap(request: FastifyRequest) {
	const existingMap = requestContextCache.get(request);
	if (existingMap) {
		return existingMap;
	}

	const nextMap = new Map<string, PermissionContext>();
	requestContextCache.set(request, nextMap);
	return nextMap;
}

async function resolveRequestPermissionContext(
	request: FastifyRequest,
	slug: string,
) {
	const requestContextMap = getRequestContextMap(request);
	const cachedContext = requestContextMap.get(slug);
	if (cachedContext) {
		return cachedContext;
	}

	let userId: string;
	try {
		const authPayload = await request.jwtVerify<{ sub: string }>();
		userId = authPayload.sub;
	} catch {
		throw new UnauthorizedError("Invalid auth token");
	}

	const membership = await prisma.member.findFirst({
		where: {
			userId,
			organization: {
				slug,
			},
		},
		select: {
			id: true,
			role: true,
			userId: true,
			organization: {
				select: {
					id: true,
					ownerId: true,
				},
			},
		},
	});

	if (!membership) {
		throw new UnauthorizedError("You're not a member of this organization.");
	}

	const effectivePermissions = await resolveEffectivePermissions({
		organizationId: membership.organization.id,
		memberId: membership.id,
		role: membership.role,
		userId: membership.userId,
		ownerId: membership.organization.ownerId,
	});

	const resolvedContext: PermissionContext = {
		userId: membership.userId,
		memberId: membership.id,
		role: membership.role,
		organizationId: membership.organization.id,
		ownerId: membership.organization.ownerId,
		effectivePermissions: new Set(effectivePermissions),
	};
	requestContextMap.set(slug, resolvedContext);

	return resolvedContext;
}

export async function getRequestEffectivePermissions(
	request: FastifyRequest,
	slug: string,
) {
	const context = await resolveRequestPermissionContext(request, slug);
	return Array.from(context.effectivePermissions).sort((first, second) =>
		first.localeCompare(second),
	);
}

export async function hasRequestPermission(
	request: FastifyRequest,
	slug: string,
	permissionKey: PermissionKey | string,
) {
	const context = await resolveRequestPermissionContext(request, slug);
	return context.effectivePermissions.has(permissionKey);
}

export async function requireRequestPermission(
	request: FastifyRequest,
	slug: string,
	permissionKey: PermissionKey | string,
) {
	const hasPermission = await hasRequestPermission(request, slug, permissionKey);
	if (!hasPermission) {
		throw new ForbiddenError(
			`You don't have permission to access "${permissionKey}".`,
		);
	}
}

export async function hasRequestAnyPermission(
	request: FastifyRequest,
	slug: string,
	permissionKeys: readonly (PermissionKey | string)[],
) {
	if (permissionKeys.length === 0) {
		return true;
	}

	const context = await resolveRequestPermissionContext(request, slug);
	return permissionKeys.some((permissionKey) =>
		context.effectivePermissions.has(permissionKey),
	);
}

export async function requireRequestAnyPermission(
	request: FastifyRequest,
	slug: string,
	permissionKeys: readonly (PermissionKey | string)[],
) {
	const hasPermission = await hasRequestAnyPermission(
		request,
		slug,
		permissionKeys,
	);
	if (!hasPermission) {
		throw new ForbiddenError(
			`You don't have permission to access this resource. Required any of: ${permissionKeys.join(", ")}.`,
		);
	}
}
