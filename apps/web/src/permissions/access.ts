import { createContextualCan } from "@casl/react";
import { useContext } from "react";
import { AbilityContext } from "./context";

export const Can = createContextualCan(AbilityContext.Consumer);

export function useAbility() {
	return useContext(AbilityContext);
}

export function useCanPermission(permissionKey: string) {
	const ability = useAbility();
	return ability.can("access", permissionKey);
}

export function useCanAnyPermission(permissionKeys: readonly string[]) {
	const ability = useAbility();
	return permissionKeys.some((permissionKey) =>
		ability.can("access", permissionKey),
	);
}
