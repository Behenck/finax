import { createContext, useContext } from "react";
import type { OrganizationRoleEnumKey } from "@/http/generated";

type User = {
	id: string;
	name: string | null;
	email: string;
	avatarUrl: string | null;
};

type Organization = {
	id: string;
	memberId: string;
	name: string;
	slug: string;
	ownerId: string;
	enableSalesTransactionsSync: boolean;
};

type AppContextType = {
	auth: User | null;
	organization: Organization | null;
	membership: OrganizationRoleEnumKey | null;
	effectivePermissions: string[];
};

export const AppContext = createContext<AppContextType>({
	auth: null,
	organization: null,
	membership: null,
	effectivePermissions: [],
});

export const useApp = () => useContext(AppContext);
