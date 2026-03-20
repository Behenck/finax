import { createContext } from "react";
import { createAppAbility, type AppAbility } from "./ability";

const EMPTY_ABILITY = createAppAbility([]);

export const AbilityContext = createContext<AppAbility>(EMPTY_ABILITY);
