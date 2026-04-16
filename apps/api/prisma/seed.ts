import "dotenv/config";

import { hash } from "bcryptjs";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { PERMISSION_CATALOG } from "../src/permissions/catalog";
import { Role } from "../generated/prisma/enums";

const DEFAULT_ADMIN = {
	name: "Admin Finax",
	email: "admin@finax.local",
};

const DEFAULT_ORGANIZATION = {
	name: "Finax",
	slug: "finax",
};

type PrismaContext = Prisma.TransactionClient | typeof prisma;

function assertDatabaseUrl() {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL environment variable is required.");
	}
}

async function assertEmptyEntryData() {
	const [usersCount, organizationsCount, permissionsCount] = await Promise.all([
		prisma.user.count(),
		prisma.organization.count(),
		prisma.permission.count(),
	]);

	if (usersCount > 0 || organizationsCount > 0 || permissionsCount > 0) {
		throw new Error(
			[
				"Seed aborted: this seed was designed for an empty database.",
				`Found users=${usersCount}, organizations=${organizationsCount}, permissions=${permissionsCount}.`,
				"Use an empty database before running the backend seed.",
			].join(" "),
		);
	}
}

function getSeedAdmin() {
	const password = process.env.SEED_ADMIN_PASSWORD;

	if (!password) {
		throw new Error(
			"SEED_ADMIN_PASSWORD environment variable is required to run the backend seed.",
		);
	}

	return {
		name: process.env.SEED_ADMIN_NAME ?? DEFAULT_ADMIN.name,
		email: process.env.SEED_ADMIN_EMAIL ?? DEFAULT_ADMIN.email,
		password,
	};
}

function getSeedOrganization() {
	return {
		name: process.env.SEED_ORGANIZATION_NAME ?? DEFAULT_ORGANIZATION.name,
		slug: process.env.SEED_ORGANIZATION_SLUG ?? DEFAULT_ORGANIZATION.slug,
	};
}

async function syncPermissions(ctx: PrismaContext) {
	console.log(
		`[seed] Syncing ${PERMISSION_CATALOG.length} permissions from catalog...`,
	);

	for (const permission of PERMISSION_CATALOG) {
		await ctx.permission.create({
			data: {
				key: permission.key,
				module: permission.module,
				action: permission.action,
				description: permission.description,
				isActive: true,
			},
		});
	}
}

async function createAdminContext(ctx: PrismaContext) {
	console.log("[seed] Creating admin user and default organization...");

	const seedAdmin = getSeedAdmin();
	const seedOrganization = getSeedOrganization();
	const passwordHash = await hash(seedAdmin.password, 12);

	const user = await ctx.user.create({
		data: {
			name: seedAdmin.name,
			email: seedAdmin.email,
			passwordHash,
			emailVerifiedAt: new Date(),
		},
	});

	const organization = await ctx.organization.create({
		data: {
			name: seedOrganization.name,
			slug: seedOrganization.slug,
			ownerId: user.id,
		},
	});

	await ctx.member.create({
		data: {
			organizationId: organization.id,
			userId: user.id,
			role: Role.ADMIN,
		},
	});

	return { user, organization };
}

async function main() {
	console.log("[seed] Starting backend seed...");

	await assertDatabaseUrl();

	console.log("[seed] Validating database state...");
	await assertEmptyEntryData();

	const { user, organization } = await prisma.$transaction(async (tx) => {
		await syncPermissions(tx);
		return createAdminContext(tx);
	});

	console.log("[seed] Seed completed successfully.");
	console.log(
		`[seed] Admin: ${user.email} | Organization: ${organization.slug}`,
	);
}

main()
	.catch((error: unknown) => {
		console.error("[seed] Seed failed.");
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
