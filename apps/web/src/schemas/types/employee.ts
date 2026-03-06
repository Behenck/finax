export interface Employee {
	id: string;
	name: string;
	role: string | null;
	email: string;
	phone: string | null;
	department: string | null;
	cpf: string | null;
	pixKeyType: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM" | null;
	pixKey: string | null;
	paymentNotes: string | null;
	country: string | null;
	state: string | null;
	city: string | null;
	street: string | null;
	zipCode: string | null;
	neighborhood: string | null;
	number: string | null;
	complement: string | null;
	userId: string | null;
	linkedUser: {
		id: string;
		name: string | null;
		email: string;
		avatarUrl: string | null;
		membership: {
			id: string;
			role: "ADMIN" | "MEMBER" | "SUPERVISOR" | "SELLER" | "PARTNER";
			accesses: Array<{
				companyId: string;
				companyName: string;
				unitId: string | null;
				unitName: string | null;
			}>;
		} | null;
	} | null;
	company: {
		id: string;
		name: string;
	};
	unit: {
		id: string;
		name: string;
	} | null;
}
