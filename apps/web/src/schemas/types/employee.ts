export interface Employee {
	id: string;
	name: string;
	role: string | null;
	email: string;
	department: string | null;
	company: {
		id: string;
		name: string;
	};
}
