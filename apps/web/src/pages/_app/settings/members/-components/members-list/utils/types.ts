import type { MembersRoleEnumKey } from "@/http/generated";

export type MemberAccess = {
	companyId: string;
	companyName: string;
	unitId: string | null;
	unitName: string | null;
};

export type MemberListItem = {
	id: string;
	userId: string;
	role: MembersRoleEnumKey;
	customersScope?: MemberDataScopeValue;
	salesScope?: MemberDataScopeValue;
	commissionsScope?: MemberDataScopeValue;
	name: string | null;
	avatarUrl: string | null;
	email: string;
	accesses?: MemberAccess[];
};

export type MemberDataScopeValue =
	| "LINKED_ONLY"
	| "COMPANY_ONLY"
	| "ORGANIZATION_ALL";

export type CompanyOption = {
	id: string;
	name: string;
	units: Array<{
		id: string;
		name: string;
	}>;
};

export type RoleFilter =
	| "ALL"
	| "ADMIN"
	| "MEMBER"
	| "SUPERVISOR"
	| "SELLER"
	| "PARTNER";
