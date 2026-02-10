import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./route-tree.gen";

export const router = createRouter({ routeTree });