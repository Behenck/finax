import { createContext, useContext } from "react";

type User = {
	id: string;
	name: string | null;
	email: string;
	avatarUrl: string | null;
};

type AppContextType = {
	auth: User | null;
};

export const AppContext = createContext<AppContextType>({
	auth: null,
});

export const useApp = () => useContext(AppContext);
