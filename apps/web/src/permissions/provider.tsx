import { useMemo, type PropsWithChildren } from "react";
import { createAppAbility } from "./ability";
import { AbilityContext } from "./context";

type PermissionsProviderProps = PropsWithChildren<{
	effectivePermissions: readonly string[];
}>;

export function PermissionsProvider({
	effectivePermissions,
	children,
}: PermissionsProviderProps) {
	const ability = useMemo(
		() => createAppAbility(effectivePermissions),
		[effectivePermissions],
	);

	return (
		<AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>
	);
}
