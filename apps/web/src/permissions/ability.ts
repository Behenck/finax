import {
	AbilityBuilder,
	type MongoAbility,
	createMongoAbility,
} from "@casl/ability";

export type PermissionAction = "access";
export type PermissionSubject = string;
export type AppAbility = MongoAbility<[PermissionAction, PermissionSubject]>;

export function createAppAbility(
	effectivePermissions: readonly string[] = [],
): AppAbility {
	const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

	for (const permissionKey of effectivePermissions) {
		can("access", permissionKey);
	}

	return build();
}
