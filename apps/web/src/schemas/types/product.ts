export interface ProductListItem {
	id: string;
	name: string;
	description: string | null;
	parentId: string | null;
	isActive: boolean;
	sortOrder: number;
	salesTransactionCategoryId: string | null;
	salesTransactionCostCenterId: string | null;
	children?: ProductListItem[];
}

export type Product = ProductListItem;
export type ProductChild = ProductListItem;
