import { createContext, useContext } from "react";
import type { OrganizationRoleEnumKey } from "@/http/generated"; // ajuste o import

type User = {
	id: string;
	name: string | null;
	email: string;
	avatarUrl: string | null;
};

type Organization = {
	id: string;
	name: string;
	slug: string;
	ownerId: string
};

type AppContextType = {
	auth: User | null;
	organization: Organization | null;
	membership: OrganizationRoleEnumKey | null;
};

export const AppContext = createContext<AppContextType>({
	auth: null,
	organization: null,
	membership: null,
});

export const useApp = () => useContext(AppContext);
