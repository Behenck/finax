import type { CategoriesTypeEnumKey } from "@/http/generated";

export interface CategoryChild {
	id: string;
	name: string;
	code?: string;
	type: CategoriesTypeEnumKey;
	color: string;
	icon: string;
	parentId: string;
}

export interface Category {
	id: string;
	name: string;
	code?: string;
	type: CategoriesTypeEnumKey;
	color: string;
	icon: string;
	parentId: null;
	children?: CategoryChild[];
}
