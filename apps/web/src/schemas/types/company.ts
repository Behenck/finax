import type { Unit } from "./unit";

export interface Company {
	id: string;
	name: string;
	units: Unit[];
}
