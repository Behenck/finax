export interface ProductListItem {
	id: string;
	name: string;
	description: string | null;
	parentId: string | null;
	isActive: boolean;
	sortOrder: number;
	children?: ProductListItem[];
}

export type Product = ProductListItem;
export type ProductChild = ProductListItem;
