import "dotenv/config";

import { hash } from "bcryptjs";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { PERMISSION_CATALOG } from "../src/permissions/catalog";
import { Role } from "../generated/prisma/enums";

const DEFAULT_ADMIN = {
	name: "Denilson Behenck",
	email: "denilson@arkogrupo.com",
	password: "behenck",
};

const DEFAULT_ORGANIZATION = {
	name: "Arko Grupo",
	slug: "arko-grupo",
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

	const passwordHash = await hash(DEFAULT_ADMIN.password, 6);

	const user = await ctx.user.create({
		data: {
			name: DEFAULT_ADMIN.name,
			email: DEFAULT_ADMIN.email,
			passwordHash,
			emailVerifiedAt: new Date(),
		},
	});

	const organization = await ctx.organization.create({
		data: {
			name: DEFAULT_ORGANIZATION.name,
			slug: DEFAULT_ORGANIZATION.slug,
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
		`[seed] Admin: ${user.email} | Password: ${DEFAULT_ADMIN.password} | Organization: ${organization.slug}`,
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
