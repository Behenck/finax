export interface ProductChild {
	id: string;
	name: string;
	description: string | null;
	parentId: string;
	isActive: boolean;
	sortOrder: number;
	children?: ProductChild[];
}

export interface Product {
	id: string;
	name: string;
	description: string | null;
	parentId: null;
	isActive: boolean;
	sortOrder: number;
	children?: ProductChild[];
}

export type ProductListItem = Product | ProductChild;
