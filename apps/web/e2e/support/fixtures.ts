export const sessionFixture = {
	user: {
		id: "user-1",
		name: "Usuario E2E",
		email: "e2e@example.com",
		avatarUrl: null,
	},
	organization: {
		id: "org-1",
		name: "Organizacao E2E",
		slug: "org-e2e",
		role: "ADMIN",
		ownerId: "user-1",
	},
} as const;

export const membersFixture = [
	{
		id: "member-1",
		userId: "user-1",
		role: "ADMIN",
		name: "Usuario E2E",
		avatarUrl: null,
		email: "e2e@example.com",
		accesses: [],
	},
	{
		id: "member-2",
		userId: "user-2",
		role: "MEMBER",
		name: "Maria Silva",
		avatarUrl: null,
		email: "maria@example.com",
		accesses: [],
	},
] as const;

export const companiesFixture = [
	{
		id: "company-1",
		name: "Empresa E2E",
		units: [
			{
				id: "unit-1",
				name: "Matriz",
			},
		],
		employees: [],
	},
] as const;

export const pendingInvitesFixture = [
	{
		id: "pending-invite-1",
		createdAt: "2026-01-10T10:00:00.000Z",
		role: "ADMIN",
		email: "ana.admin@example.com",
		author: {
			id: "user-1",
			name: "Usuario E2E",
		},
	},
	{
		id: "pending-invite-2",
		createdAt: "2026-01-11T10:00:00.000Z",
		role: "MEMBER",
		email: "bruno.member@example.com",
		author: {
			id: "user-2",
			name: "Maria Silva",
		},
	},
] as const;

export const emailInviteFixture = {
	id: "invite-email-1",
	email: "invitee@example.com",
	role: "MEMBER",
	type: "EMAIL",
	createdAt: "2026-01-12T10:00:00.000Z",
	author: {
		id: "user-1",
		name: "Usuario E2E",
		avatarUrl: null,
	},
	organization: {
		name: "Organizacao E2E",
		slug: "org-e2e",
	},
} as const;

export const linkInviteFixture = {
	id: "invite-link-1",
	email: null,
	role: "MEMBER",
	type: "LINK",
	createdAt: "2026-01-13T10:00:00.000Z",
	author: {
		id: "user-1",
		name: "Usuario E2E",
		avatarUrl: null,
	},
	organization: {
		name: "Organizacao E2E",
		slug: "org-e2e",
	},
} as const;
